import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Proxy } from '../db/models/Proxy.js';
import { BannedProxy } from '../db/models/BannedProxy.js';

export const ProxyService = {
    proxies: [],
    currentIndex: 0,
    workingProxies: new Set(),
    agentCache: new Map(),
    
    // Configurable proxy sources
    proxySources: [
        'https://raw.githubusercontent.com/officialputuid/KangProxy/refs/heads/KangProxy/socks5/socks5.txt',
        // 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt', // Fallback example
    ],

    async getProxiesPaginated(page = 1, limit = 50, search = '') {
        const skip = (page - 1) * limit;
        let query = {};
        if (search) {
            query = {
                $or: [
                    { host: { $regex: search, $options: 'i' } },
                    { type: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const proxies = await Proxy.find(query)
            .sort({ lastChecked: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await Proxy.countDocuments(query);
        
        return {
            proxies,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        };
    },

    async bulkAddProxies(rawProxies) {
        const parsedProxies = this.parseProxyLines(rawProxies);
        if (parsedProxies.length === 0) return { count: 0 };

        // Check against ban list
        const bannedChecks = parsedProxies.map(p => ({ host: p.host, port: p.port }));
        const bannedProxies = await BannedProxy.find({ $or: bannedChecks }).select('host port').lean();
        const bannedSet = new Set(bannedProxies.map(p => `${p.host}:${p.port}`));
        
        const cleanProxies = parsedProxies.filter(p => !bannedSet.has(`${p.host}:${p.port}`));
        const bannedCount = parsedProxies.length - cleanProxies.length;

        if (cleanProxies.length === 0) {
            return { count: 0, bannedCount, details: { upsertedCount: 0, modifiedCount: 0 } };
        }

        const bulkOps = cleanProxies.map(p => ({
            updateOne: {
                filter: { host: p.host, port: p.port },
                update: { 
                    $set: { 
                        auth: p.auth, 
                        type: p.type,
                        source: 'manual'
                    },
                    $setOnInsert: { 
                        host: p.host, 
                        port: p.port
                    } 
                },
                upsert: true
            }
        }));

        let result = { upsertedCount: 0, modifiedCount: 0 };
        const chunkSize = 1000;
        for (let i = 0; i < bulkOps.length; i += chunkSize) {
            const res = await Proxy.bulkWrite(bulkOps.slice(i, i + chunkSize));
            result.upsertedCount += res.upsertedCount;
            result.modifiedCount += res.modifiedCount;
        }

        await this.refreshProxiesFromDB();
        return { count: cleanProxies.length, bannedCount, details: result };
    },

    async bulkDeleteProxies(ids) {
        const result = await Proxy.deleteMany({ _id: { $in: ids } });
        await this.refreshProxiesFromDB();
        return result;
    },

    async loadProxies() {
        try {
            console.log('🔄 Fetching fresh proxies from remote sources...');
            let remoteProxies = [];
            
            for (const source of this.proxySources) {
                try {
                    const response = await axios.get(source, { timeout: 10000 });
                    if (response.data) {
                        const lines = response.data.split('\n');
                        const sourceProxies = this.parseProxyLines(lines);
                        console.log(`   - Fetched ${sourceProxies.length} proxies from ${source}`);
                        remoteProxies = remoteProxies.concat(sourceProxies);
                    }
                } catch (err) {
                    console.warn(`   ⚠️ Failed to fetch from ${source}: ${err.message}`);
                }
            }

            // Also load local file if exists
            const localProxies = this.loadLocalProxies();
            
            // Combine and Deduplicate
            const allProxies = [...remoteProxies, ...localProxies];
            
            // Deduplicate based on host:port
            const uniqueMap = new Map();
            allProxies.forEach(p => {
                const key = `${p.host}:${p.port}`;
                if (!uniqueMap.has(key)) uniqueMap.set(key, p);
            });
            
            const uniqueProxies = Array.from(uniqueMap.values());
            console.log(`✅ Total unique proxies found: ${uniqueProxies.length}`);

            // Upsert into Database
            console.log('💾 Saving proxies to database...');
            const bulkOps = uniqueProxies.map(p => ({
                updateOne: {
                    filter: { host: p.host, port: p.port },
                    update: { 
                        $setOnInsert: { 
                            host: p.host, 
                            port: p.port, 
                            auth: p.auth, 
                            type: p.type 
                        } 
                    },
                    upsert: true
                }
            }));

            if (bulkOps.length > 0) {
                try {
                    // Execute in chunks to avoid large payload limits
                    const chunkSize = 1000;
                    for (let i = 0; i < bulkOps.length; i += chunkSize) {
                        await Proxy.bulkWrite(bulkOps.slice(i, i + chunkSize));
                    }
                    console.log('✅ Proxies saved/updated in database.');
                } catch (dbError) {
                    console.error('❌ Database write failed:', dbError);
                }
            }

            // Load valid proxies from Database
            await this.refreshProxiesFromDB();
            
            // Start periodic refresh every 10 minutes to check for recovered proxies
            if (!this.refreshInterval) {
                this.refreshInterval = setInterval(() => this.refreshProxiesFromDB(), 10 * 60 * 1000);
            }

            // Save to file for cache/backup
            this.saveProxiesToFile();

        } catch (error) {
            console.error('Failed to load proxies:', error);
        }
    },

    async refreshProxiesFromDB() {
        try {
            // Find proxies where timeoutUntil is null or in the past
            const query = {
                $or: [
                    { timeoutUntil: null },
                    { timeoutUntil: { $lt: new Date() } }
                ]
            };

            const dbProxies = await Proxy.find(query).select('host port auth type failCount timeoutUntil').lean();
            
            if (dbProxies.length > 0) {
                this.proxies = dbProxies;
                console.log(`✅ Loaded ${this.proxies.length} active proxies from database.`);
                
                // Shuffle for better distribution
                this.shuffleProxies();
            } else {
                console.warn('⚠️ No active proxies found in database.');
            }
        } catch (error) {
            console.error('❌ Failed to refresh proxies from DB:', error);
        }
    },

    loadLocalProxies() {
        try {
            const proxyPath = path.join(process.cwd(), 'x-scraper', 'proxies_list.txt');
            if (!fs.existsSync(proxyPath)) return [];

            const content = fs.readFileSync(proxyPath, 'utf-8');
            return this.parseProxyLines(content.split('\n'));
        } catch (e) {
            console.warn('Error reading local proxy file:', e.message);
            return [];
        }
    },

    parseProxyLines(lines) {
        return lines
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#') && line.includes(':'))
            .map(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    return {
                        host: parts[0],
                        port: parseInt(parts[1]),
                        auth: parts.length >= 4 ? `${parts[2]}:${parts[3]}` : null,
                        type: 'socks5' // Defaulting to socks5 based on the user's requested source
                    };
                }
                return null;
            })
            .filter(p => p !== null);
    },

    saveProxiesToFile() {
        try {
             const proxyPath = path.join(process.cwd(), 'x-scraper', 'proxies_list.txt');
             const content = this.proxies.map(p => {
                 if (p.auth) return `${p.host}:${p.port}:${p.auth}`;
                 return `${p.host}:${p.port}`;
             }).join('\n');
             fs.writeFileSync(proxyPath, content);
        } catch (e) {
            console.warn('Failed to save proxies to file:', e.message);
        }
    },


    guessType(port) {
        const p = parseInt(port);
        if ([1080, 1081, 9050, 9051].includes(p)) return 'socks5';
        return 'http';
    },

    shuffleProxies() {
        for (let i = this.proxies.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.proxies[i], this.proxies[j]] = [this.proxies[j], this.proxies[i]];
        }
    },

    getNextProxy() {
        if (this.proxies.length === 0) return null;
        
        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    },

    getAgent(proxy) {
        if (!proxy) return null;

        const auth = proxy.auth ? `${proxy.auth}@` : '';
        const protocol = proxy.type === 'socks5' ? 'socks5' : 'http';
        const url = `${protocol}://${auth}${proxy.host}:${proxy.port}`;
        
        const cacheKey = url;
        if (this.agentCache.has(cacheKey)) {
            return this.agentCache.get(cacheKey);
        }

        let agent;
        if (proxy.type === 'socks5') {
            agent = new SocksProxyAgent(url, {
                keepAlive: true,
                timeout: 10000,
                // SOCKS agent doesn't support maxSockets out of the box like http.Agent, but uses net.connect
            });
        } else {
            agent = new HttpsProxyAgent(url, {
                keepAlive: true,
                timeout: 10000,
                maxSockets: 50, // Per proxy limit
                maxFreeSockets: 10,
                scheduling: 'lifo',
                rejectUnauthorized: false // Allow self-signed certs (common in free proxies)
            });
        }
        
        this.agentCache.set(cacheKey, agent);
        return agent;
    },

    async getStats() {
        try {
            const total = await Proxy.countDocuments();
            const working = await Proxy.countDocuments({
                $or: [
                    { timeoutUntil: null },
                    { timeoutUntil: { $lt: new Date() } }
                ]
            });
            return { total, working, failed: total - working };
        } catch (error) {
            return { total: this.proxies.length, working: this.proxies.length, failed: 0 };
        }
    },

    async reportFailure(proxy) {
        if (!proxy) return;
        
        try {
            // Find proxy in memory
            const memProxy = this.proxies.find(p => p.host === proxy.host && p.port === proxy.port);
            if (memProxy) {
                memProxy.failCount = (memProxy.failCount || 0) + 1;
                
                if (memProxy.failCount > 5) {
                    console.log(`❌ Proxy ${proxy.host}:${proxy.port} failed >5 times. BANNING.`);
                    
                    // Remove from active list
                    this.proxies = this.proxies.filter(p => p.host !== proxy.host || p.port !== proxy.port);
                    this.agentCache.delete(`${proxy.type === 'socks5' ? 'socks5' : 'http'}://${proxy.auth ? proxy.auth + '@' : ''}${proxy.host}:${proxy.port}`);

                    // Add to Ban List
                    await BannedProxy.create({ host: proxy.host, port: proxy.port, reason: 'Excessive failures (>5)' })
                        .catch(err => console.log('Already banned or error banning:', err.message));

                    // Remove from Proxy List
                    await Proxy.deleteOne({ host: proxy.host, port: proxy.port });

                } else if (memProxy.failCount >= 2) {
                    console.log(`⚠️ Proxy ${proxy.host}:${proxy.port} failed ${memProxy.failCount} times. Timing out for 24h.`);
                    
                    // Remove from active list
                    this.proxies = this.proxies.filter(p => p.host !== proxy.host || p.port !== proxy.port);
                    this.agentCache.delete(`${proxy.type === 'socks5' ? 'socks5' : 'http'}://${proxy.auth ? proxy.auth + '@' : ''}${proxy.host}:${proxy.port}`);

                    // Update DB
                    const timeoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                    await Proxy.updateOne(
                        { host: proxy.host, port: proxy.port },
                        { 
                            $set: { 
                                failCount: memProxy.failCount, // Persist failure count
                                timeoutUntil: timeoutUntil,
                                isWorking: false
                            }
                        }
                    );
                } else {
                    // Just update fail count in DB
                    await Proxy.updateOne(
                        { host: proxy.host, port: proxy.port },
                        { $inc: { failCount: 1 } }
                    );
                }
            }
        } catch (error) {
            console.error('Error reporting proxy failure:', error);
        }
    },

    async reportSuccess(proxy) {
        if (!proxy) return;

        try {
             // Find proxy in memory
             const memProxy = this.proxies.find(p => p.host === proxy.host && p.port === proxy.port);
             if (memProxy && memProxy.failCount > 0) {
                 memProxy.failCount = 0;
                 // Reset in DB
                 await Proxy.updateOne(
                    { host: proxy.host, port: proxy.port },
                    { $set: { failCount: 0, isWorking: true } }
                );
             }
        } catch (error) {
            console.error('Error reporting proxy success:', error);
        }
    }
};
