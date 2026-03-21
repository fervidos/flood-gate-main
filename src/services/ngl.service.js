import axios from 'axios';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { deviceid } from "../utils/functions/deviceid.js";
import { ip } from "../utils/functions/ip.js";
import { getRandomUserAgent } from "../utils/useragents.js";
import { ProxyService } from "./proxy.service.js";

// Connection pooling - OPTIMIZED for minimal bandwidth
// Lower socket counts = more connection reuse = fewer TLS handshakes = less proxy bandwidth
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 60000, // Keep connections alive longer
    maxSockets: 500,       // Increased for higher concurrency while maintaining reuse
    maxFreeSockets: 100,   // Increased buffer
    timeout: 15000
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 60000,
    maxSockets: 500,       // Increased for higher concurrency
    maxFreeSockets: 100,   // Increased buffer
    timeout: 15000,
    // Modern Cipher Suite for stealth (mimic Chrome/modern browsers)
    ciphers: [
        'TLS_AES_128_GCM_SHA256',
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-RSA-AES128-SHA',
        'ECDHE-RSA-AES256-SHA',
        'AES128-GCM-SHA256',
        'AES256-GCM-SHA384'
    ].join(':'),
    honorCipherOrder: true,
    minVersion: 'TLSv1.2',
    secureOptions: crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1
});

// Create axios instance with connection pooling
const axiosInstance = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 10000,
    maxRedirects: 0,       // Disable redirects to save bandwidth
    decompress: true       // Accept compressed responses
});

export const NGLService = {
    /**
     * Generate realistic browser headers (optimized - removed redundant ones)
     * @param {string} userAgent
     * @returns {Object}
     */
    getRandomHeaders(userAgent) {
        const referers = [
            'https://www.instagram.com/',
            'https://www.tiktok.com/',
            'https://twitter.com/',
            'https://ngl.link/'
        ];

        const referer = referers[Math.floor(Math.random() * referers.length)];

        // Detect Platform
        let platform = '"Windows"';
        let mobile = '?0';

        if (userAgent.includes('Android')) {
            platform = '"Android"';
            mobile = '?1';
        } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
            platform = '"iOS"';
            mobile = '?1';
        } else if (userAgent.includes('Macintosh')) {
            platform = '"macOS"';
            mobile = '?0';
        } else if (userAgent.includes('Linux')) {
            platform = '"Linux"';
            mobile = '?0';
        }

        // Base headers
        const headers = {
            'Host': 'ngl.link',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': userAgent,
            'Origin': 'https://ngl.link',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': '*/*',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            'Referer': referer,
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        // Add Client Hints for Chrome/Edge
        if (userAgent.includes('Chrome') || userAgent.includes('Edg')) {
            const brands = [];
            if (userAgent.includes('Edg')) {
                 brands.push('"Microsoft Edge";v="123"');
                 brands.push('"Not:A-Brand";v="8"');
                 brands.push('"Chromium";v="123"');
            } else {
                 brands.push('"Google Chrome";v="123"');
                 brands.push('"Not:A-Brand";v="8"');
                 brands.push('"Chromium";v="123"');
            }
            
            headers['sec-ch-ua'] = brands.join(', ');
            headers['sec-ch-ua-mobile'] = mobile;
            headers['sec-ch-ua-platform'] = platform;
        }

        return headers;
    },

    /**
     * Calculate approximate size of request
     */
    calculateRequestSize(headers, data) {
        // Approximate header size
        let headerSize = 0;
        for (const [key, value] of Object.entries(headers)) {
            headerSize += key.length + value.length + 4; // ": " and "\r\n"
        }

        // Data size (form-encoded)
        const dataStr = new URLSearchParams(data).toString();
        const dataSize = new TextEncoder().encode(dataStr).length;

        return headerSize + dataSize + 100; // +100 for HTTP overhead
    },

    /**
     * Send a message to NGL with retry logic and connection pooling
     * @param {string} username - NGL username
     * @param {string} message - Message content
     * @param {number} retries - Number of retry attempts (default: 2)
     * @returns {Promise<{success: boolean, status?: number, error?: string}>}
     */
    async sendMessage(username, message, retries = 1) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            const startTime = Date.now();
            let proxyUrl = null;
            let proxy = null;

            try {
                const deviceId = await deviceid();
                
                // Get Proxy
                proxy = ProxyService.getNextProxy();
                const proxyAgent = ProxyService.getAgent(proxy);
                proxyUrl = proxy ? `${proxy.host}:${proxy.port}` : null;

                const userAgent = getRandomUserAgent();

                // Get realistic headers
                const headers = this.getRandomHeaders(userAgent);

                const url = 'https://ngl.link/api/submit';

                const data = {
                    username: username.toLowerCase(),
                    question: message,
                    deviceId: deviceId,
                    gameSlug: '',
                    referrer: headers['Referer']
                };

                // Calculate request size for bandwidth tracking
                const requestSize = this.calculateRequestSize(headers, data);

                const config = { 
                    headers,
                    // If proxy is available, use its agent. Otherwise fallback to pool.
                    httpsAgent: proxyAgent || undefined,
                    httpAgent: proxyAgent || undefined
                };

                const response = await axiosInstance.post(url, data, config);
                const latency = Date.now() - startTime;

                // Estimate response size (headers + body)
                const responseSize = response.headers['content-length']
                    ? parseInt(response.headers['content-length']) + 200 // +200 for response headers
                    : 500; // Default estimate if no content-length

                if (response.status === 200) {
                    ProxyService.reportSuccess(proxy);
                    return {
                        success: true,
                        status: response.status,
                        latency,
                        proxy: proxyUrl,
                        timestamp: Date.now(),
                        bytesSent: requestSize,
                        bytesReceived: responseSize
                    };
                } else {
                    ProxyService.reportFailure(proxy);
                    return {
                        success: false,
                        status: response.status,
                        error: `HTTP ${response.status}`,
                        latency,
                        proxy: proxyUrl,
                        timestamp: Date.now(),
                        bytesSent: requestSize,
                        bytesReceived: responseSize
                    };
                }
            } catch (error) {
                ProxyService.reportFailure(proxy);
                const latency = Date.now() - startTime;

                // If this is the last retry, return failure
                if (attempt === retries) {
                    return {
                        success: false,
                        error: error.code || error.message,
                        details: error.response?.data || null,
                        status: error.response?.status || 0,
                        latency,
                        proxy: proxyUrl,
                        timestamp: Date.now()
                    };
                }

                // Exponential backoff: wait before retrying
                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }

        // Should never reach here, but just in case
        return { success: false, error: 'Max retries exceeded', timestamp: Date.now() };
    },

    /**
     * Send a message by trying each proxy in the pool sequentially until one succeeds.
     * Moves immediately to the next proxy on failure — no backoff delay.
     * @param {string} username
     * @param {string} message
     * @returns {Promise<{success: boolean, proxy?: string, ...}>}
     */
    async sendMessageWithProxyFallback(username, message) {
        const proxies = ProxyService.proxies;

        // No proxies — fall back to single direct attempt
        if (proxies.length === 0) {
            return this.sendMessage(username, message, 0);
        }

        // Walk through every proxy once, starting from the current round-robin index
        const startIndex = ProxyService.currentIndex;
        const total = proxies.length;

        for (let i = 0; i < total; i++) {
            const proxyIdx = (startIndex + i) % total;
            const proxy = proxies[proxyIdx];

            // Advance the global round-robin cursor so the next call continues from here
            ProxyService.currentIndex = (proxyIdx + 1) % total;

            const startTime = Date.now();
            const proxyUrl = `${proxy.host}:${proxy.port}`;

            try {
                const deviceId = await import('../utils/functions/deviceid.js').then(m => m.deviceid());
                const { getRandomUserAgent } = await import('../utils/useragents.js');
                const userAgent = getRandomUserAgent();
                const headers = this.getRandomHeaders(userAgent);
                const proxyAgent = ProxyService.getAgent(proxy);

                const url = 'https://ngl.link/api/submit';
                const data = {
                    username: username.toLowerCase(),
                    question: message,
                    deviceId,
                    gameSlug: '',
                    referrer: headers['Referer']
                };

                const response = await axiosInstance.post(url, data, {
                    headers,
                    httpsAgent: proxyAgent || undefined,
                    httpAgent: proxyAgent || undefined
                });

                const latency = Date.now() - startTime;

                if (response.status === 200) {
                    ProxyService.reportSuccess(proxy);
                    return {
                        success: true,
                        status: response.status,
                        latency,
                        proxy: proxyUrl,
                        timestamp: Date.now()
                    };
                }

                // Non-200 status — report and try next proxy
                ProxyService.reportFailure(proxy);
            } catch (_err) {
                // Network / timeout error — report and try next proxy immediately
                ProxyService.reportFailure(proxy);
            }
        }

        // All proxies exhausted without success
        return { success: false, error: 'All proxies failed', timestamp: Date.now() };
    }
};

