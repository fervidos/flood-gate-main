import fs from 'fs';
import path from 'path';
import axios from 'axios';
import mongoose from 'mongoose';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Proxy } from '../db/models/Proxy.js';
import { BannedProxy } from '../db/models/BannedProxy.js';

export const ProxyService = {
    proxies: [],
    currentIndex: 0,
    workingProxies: new Set(),
    agentCache: new Map(),
    maxBulkAdd: 500,
    maxBulkDelete: 500,
    maxPageLimit: 200,
    maxSearchLength: 64,
    maxProxyLineLength: 200,
    
    // Configurable proxy sources
    proxySources: [
        'https://raw.githubusercontent.com/databay-labs/free-proxy-list/refs/heads/master/socks5.txt',
        'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
        'https://raw.githubusercontent.com/ebrasha/abdal-proxy-hub/refs/heads/main/socks5-proxy-list-by-EbraSha.txt',
        // 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt', // Fallback example
    ],

    async getProxiesPaginated(page = 1, limit = 50, search = '') {
        const parsedPage = parseInt(page, 10);
        const parsedLimit = parseInt(limit, 10);
        const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
        const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
            ? Math.min(parsedLimit, this.maxPageLimit)
            : 50;

        const trimmedSearch = typeof search === 'string' ? search.trim() : '';
        const safeSearch = trimmedSearch.slice(0, this.maxSearchLength);
        const skip = (safePage - 1) * safeLimit;
        let query = {};
        if (safeSearch) {
            const escaped = this.escapeRegExp(safeSearch);
            query = {
                $or: [
                    { host: { $regex: escaped, $options: 'i' } },
                    { type: { $regex: escaped, $options: 'i' } }
                ]
            };
        }

        const proxies = await Proxy.find(query)
            .sort({ lastChecked: -1 })
            .skip(skip)
            .limit(safeLimit);
            
        const total = await Proxy.countDocuments(query);
        
        return {
            proxies,
            total,
            page: safePage,
            totalPages: Math.ceil(total / safeLimit)
        };
    },

    async bulkAddProxies(rawProxies) {
        if (!Array.isArray(rawProxies)) {
            return { count: 0, bannedCount: 0, invalidCount: 0, details: { upsertedCount: 0, modifiedCount: 0 } };
        }

        const trimmedLines = rawProxies
            .filter(line => typeof line === 'string')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#') && line.length <= this.maxProxyLineLength);

        const parsedProxies = this.parseProxyLines(trimmedLines);
        const invalidCount = Math.max(0, trimmedLines.length - parsedProxies.length);
        if (parsedProxies.length === 0) {
            return { count: 0, bannedCount: 0, invalidCount, details: { upsertedCount: 0, modifiedCount: 0 } };
        }

        // Check against ban list
        const bannedChecks = parsedProxies.map(p => ({ host: p.host, port: p.port }));
        const bannedProxies = await BannedProxy.find({ $or: bannedChecks }).select('host port').lean();
        const bannedSet = new Set(bannedProxies.map(p => `${p.host}:${p.port}`));
        
        const cleanProxies = parsedProxies.filter(p => !bannedSet.has(`${p.host}:${p.port}`));
        const bannedCount = parsedProxies.length - cleanProxies.length;

        if (cleanProxies.length === 0) {
            return { count: 0, bannedCount, invalidCount, details: { upsertedCount: 0, modifiedCount: 0 } };
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
        return { count: cleanProxies.length, bannedCount, invalidCount, details: result };
    },

    async bulkDeleteProxies(ids) {
        const result = await Proxy.deleteMany({ _id: { $in: ids } });
        await this.refreshProxiesFromDB();
        return result;
    },

    async loadProxies() {
        try {
            // Immediately load whatever is already in DB so the server can start right away
            await this.refreshProxiesFromDB();

            // Start periodic refresh every 10 minutes to check for recovered proxies
            if (!this.refreshInterval) {
                this.refreshInterval = setInterval(() => this.refreshProxiesFromDB(), 10 * 60 * 1000);
            }

            // Fetch & save fresh remote proxies in the background — don't block startup
            this._fetchAndSaveRemote().catch(err => console.error('Background proxy fetch error:', err));

        } catch (error) {
            console.error('Failed to load proxies:', error);
        }
    },

    async _fetchAndSaveRemote() {
        try {
            console.log('🔄 Fetching fresh proxies from remote sources (background)...');
            let remoteProxies = [];

            // Fetch all sources in parallel
            await Promise.all(this.proxySources.map(async (source) => {
                try {
                    const response = await axios.get(source, { timeout: 15000 });
                    if (response.data) {
                        const sourceProxies = this.parseProxyLines(response.data.split('\n'));
                        console.log(`   - Fetched ${sourceProxies.length} proxies from ${source}`);
                        remoteProxies = remoteProxies.concat(sourceProxies);
                    }
                } catch (err) {
                    console.warn(`   ⚠️ Failed to fetch from ${source}: ${err.message}`);
                }
            }));

            // Also load local file if exists
            const localProxies = this.loadLocalProxies();

            // Combine and deduplicate based on host:port
            const uniqueMap = new Map();
            for (const p of [...remoteProxies, ...localProxies]) {
                const key = `${p.host}:${p.port}`;
                if (!uniqueMap.has(key)) uniqueMap.set(key, p);
            }

            const uniqueProxies = Array.from(uniqueMap.values());
            console.log(`✅ Total unique proxies found: ${uniqueProxies.length}`);

            if (uniqueProxies.length === 0) return;

            // Upsert into database — parallel chunks with ordered:false for max throughput
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

            try {
                const chunkSize = 5000;
                const chunks = [];
                for (let i = 0; i < bulkOps.length; i += chunkSize) {
                    chunks.push(bulkOps.slice(i, i + chunkSize));
                }
                await Promise.all(chunks.map(chunk => Proxy.bulkWrite(chunk, { ordered: false })));
                console.log('✅ Proxies saved/updated in database.');
            } catch (dbError) {
                console.error('❌ Database write failed:', dbError);
            }

            // Reload active proxies now that DB is fresh
            await this.refreshProxiesFromDB();

            // Save to file for cache/backup
            this.saveProxiesToFile();

        } catch (error) {
            console.error('Failed to fetch/save remote proxies:', error);
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
        return (Array.isArray(lines) ? lines : [])
            .map(line => (typeof line === 'string' ? line.trim() : ''))
            .filter(line => line && !line.startsWith('#') && line.includes(':') && line.length <= this.maxProxyLineLength)
            .map(line => {
                const parts = line.split(':');
                if (parts.length !== 2 && parts.length !== 4) return null;

                const host = parts[0].trim();
                const port = Number(parts[1]);
                if (!this.isValidHost(host) || !this.isValidPort(port)) return null;

                if (parts.length === 4) {
                    const user = parts[2].trim();
                    const pass = parts[3].trim();
                    if (!user || !pass) return null;
                    return {
                        host,
                        port,
                        auth: `${user}:${pass}`,
                        type: 'socks5'
                    };
                }

                return {
                    host,
                    port,
                    auth: null,
                    type: 'socks5'
                };
            })
            .filter(p => p !== null);
    },

    escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    isValidHost(host) {
        return this.isValidIPv4(host) || this.isValidHostname(host);
    },

    isValidIPv4(host) {
        const parts = host.split('.');
        if (parts.length !== 4) return false;
        return parts.every(part => {
            if (!/^\d{1,3}$/.test(part)) return false;
            const value = Number(part);
            return value >= 0 && value <= 255;
        });
    },

    isValidHostname(host) {
        if (!host || host.length > 253) return false;
        if (!/^[a-zA-Z0-9.-]+$/.test(host)) return false;

        const labels = host.split('.');
        return labels.every(label => {
            if (!label || label.length > 63) return false;
            if (label.startsWith('-') || label.endsWith('-')) return false;
            return true;
        });
    },

    isValidPort(port) {
        return Number.isInteger(port) && port > 0 && port <= 65535;
    },

    filterValidProxyIds(ids) {
        if (!Array.isArray(ids)) return [];
        return ids.filter(id => mongoose.Types.ObjectId.isValid(id));
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
                
                if (memProxy.failCount > 20) {
                    console.log(`❌ Proxy ${proxy.host}:${proxy.port} failed >20 times. BANNING.`);
                    
                    // Remove from active list
                    this.proxies = this.proxies.filter(p => p.host !== proxy.host || p.port !== proxy.port);
                    this.agentCache.delete(`${proxy.type === 'socks5' ? 'socks5' : 'http'}://${proxy.auth ? proxy.auth + '@' : ''}${proxy.host}:${proxy.port}`);

                    // Add to Ban List
                    await BannedProxy.create({ host: proxy.host, port: proxy.port, reason: 'Excessive failures (>20)' })
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
