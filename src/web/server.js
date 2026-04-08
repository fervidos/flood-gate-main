import express from "express";
import crypto from "crypto";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import { display } from "./display.js";
import { NGLService } from "../services/ngl.service.js";
import { StatsService } from "../services/stats.service.js";
import { AttackService } from "../services/attack.service.js";
import { TemplateService } from "../services/template.service.js";
import { QueueService } from "../services/queue.service.js";
import { PresetService } from "../services/preset.service.js";
import { ProxyService } from "../services/proxy.service.js";
import { extractUsername } from "../utils/username.js";
import { AuthService } from "../services/auth.service.js";

const app = express();
const httpServer = createServer(app);
// Performance: Enable per-message deflate compression to reduce bandwidth
const io = new Server(httpServer, {
    perMessageDeflate: {
        threshold: 256, // Only compress messages > 256 bytes
        zlibDeflateOptions: {
            level: 3 // Fast compression (1-9, lower = faster)
        }
    }
});
const port = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const AUTH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: ONE_DAY_MS,
    path: '/'
};
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_COOKIE_OPTIONS = {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: ONE_DAY_MS,
    path: '/'
};
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');
const ensureCsrfCookie = (req, res) => {
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
        res.cookie(CSRF_COOKIE_NAME, generateCsrfToken(), CSRF_COOKIE_OPTIONS);
    }
};
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    return next();
};

// Performance: Track last broadcast to skip unchanged data

// Removed top-level setInterval. It is now inside startServer.

export function startServer() {
    // Broadcast stats periodically (Realtime updates: 250ms)
    setInterval(async () => {
        try {
            const stats = await StatsService.getStats();
            // Optimization: Use efficient query for top victims
            const topVictims = await StatsService.getTopVictims(5);
            const proxyCount = ProxyService.proxies.length;
            const queueStatus = await QueueService.getStatus(); // queueService.getStatus is async in definition (line 145 queue.service.js)
            const bandwidthStats = { totalSent: 0, totalReceived: 0, sessionSent: 0, sessionReceived: 0, sendRate: 0, receiveRate: 0, requestCount: 0, sessionDuration: 0, avgRequestSize: 0 };

            const payload = {
                messagesSent: stats.messagesSent,
                failedRequests: stats.failedRequests,
                successRate: stats.messagesSent > 0 ?
                    ((stats.messagesSent / (stats.messagesSent + stats.failedRequests)) * 100).toFixed(1) : 0,
                uniqueVictims: stats.uniqueVictims,
                uptime: stats.uptime,
                proxyCount: proxyCount,
                activeAttacks: AttackService.getActiveCount(),
                queueLength: queueStatus.queued,
                bandwidth: bandwidthStats,
                topVictims: topVictims
            };

            io.emit('stats_update', payload);
        } catch (error) {
            console.error('Stats broadcast error:', error);
        }
    }, 1000);

    app.disable('x-powered-by');
    app.use(express.json({ limit: '256kb' }));
    app.use(cookieParser());

    app.get('/login', (req, res) => {
        res.sendFile(path.join(process.cwd(), 'public', 'login.html'));
    });

    app.post('/api/login', async (req, res) => {
        const { username, password } = req.body;
        try {
            const result = await AuthService.login(username, password);
            if (result.success) {
                res.cookie('token', result.token, AUTH_COOKIE_OPTIONS);
                res.cookie(CSRF_COOKIE_NAME, generateCsrfToken(), CSRF_COOKIE_OPTIONS);
                res.json({ success: true });
            } else {
                res.status(401).json({ success: false, message: result.message });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    app.post('/api/logout', (req, res) => {
        res.clearCookie('token', {
            path: '/',
            sameSite: AUTH_COOKIE_OPTIONS.sameSite,
            secure: AUTH_COOKIE_OPTIONS.secure
        });
        res.clearCookie(CSRF_COOKIE_NAME, {
            path: '/',
            sameSite: CSRF_COOKIE_OPTIONS.sameSite,
            secure: CSRF_COOKIE_OPTIONS.secure
        });
        res.json({ success: true });
    });

    app.use((req, res, next) => {
        if (req.path === '/login' || req.path === '/api/login') return next();
        if (req.path.match(/\.(css|js|png|svg|ico|json|map)$/)) return next();
        
        const token = req.cookies.token;
        if (!token) {
             if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
             return res.redirect('/login');
        }

        const user = AuthService.verifyToken(token);
        if (!user) {
             if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
             return res.redirect('/login');
        }
        
        req.user = user;
        ensureCsrfCookie(req, res);
        next();
    });

    app.use((req, res, next) => {
        if (!req.path.startsWith('/api/')) return next();
        if (!CSRF_METHODS.has(req.method)) return next();
        if (req.path === '/api/login') return next();

        const csrfHeader = req.get('x-csrf-token');
        const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
        if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
            return res.status(403).json({ error: 'Invalid CSRF token' });
        }
        return next();
    });

    app.use(express.static(path.join(process.cwd(), 'public')));

    io.on('connection', (socket) => {
        console.log('Client connected');

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });

        // Handle immediate stats request
        socket.on('request_stats', async () => {
            const stats = await StatsService.getStats();
            socket.emit('stats_update', {
                messagesSent: stats.messagesSent,
                failedRequests: stats.failedRequests,
                uniqueVictims: stats.uniqueVictims,
                uptime: stats.uptime,
                proxyCount: ProxyService.proxies.length,
                activeAttacks: AttackService.getActiveCount()
            });
        });
    });

    // Proxy Manager API
    app.get('/api/proxies/manage', requireAdmin, async (req, res) => {
        try {
            const { page = 1, limit = 50, search = '' } = req.query;
            const result = await ProxyService.getProxiesPaginated(page, limit, search);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/proxies/manage', requireAdmin, async (req, res) => {
        try {
            const { proxies } = req.body;
            if (!proxies || !Array.isArray(proxies)) {
                return res.status(400).json({ error: 'Invalid proxies format' });
            }
            if (proxies.length > ProxyService.maxBulkAdd) {
                return res.status(413).json({ error: `Too many proxies. Limit is ${ProxyService.maxBulkAdd}.` });
            }
            const result = await ProxyService.bulkAddProxies(proxies);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.delete('/api/proxies/manage', requireAdmin, async (req, res) => {
        try {
            const { ids } = req.body;
            if (!ids || !Array.isArray(ids)) {
                return res.status(400).json({ error: 'Invalid IDs' });
            }
            if (ids.length > ProxyService.maxBulkDelete) {
                return res.status(413).json({ error: `Too many IDs. Limit is ${ProxyService.maxBulkDelete}.` });
            }
            const validIds = ProxyService.filterValidProxyIds(ids);
            if (validIds.length === 0) {
                return res.status(400).json({ error: 'No valid IDs provided' });
            }
            const result = await ProxyService.bulkDeleteProxies(validIds);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // --- Scheduled Attacks API ---
    app.get('/api/scheduled', async (req, res) => {
        try {
            const { ScheduleService } = await import('../services/schedule.service.js');
            const schedules = await ScheduleService.listSchedules();
            res.json(schedules);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/scheduled', async (req, res) => {
        try {
            const { username, messages, amount, intervalMinutes } = req.body;
            if (!username || !messages || !amount || !intervalMinutes) {
                return res.status(400).json({ error: 'Missing required schedule params' });
            }
            const { ScheduleService } = await import('../services/schedule.service.js');
            const userTokenData = req.user || { id: 'system', username: 'Web Admin' };
            const schedule = await ScheduleService.createSchedule({
                username, messages, amount, intervalMinutes,
                userId: userTokenData.id,
                userTag: userTokenData.username
            });
            res.json(schedule);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.delete('/api/scheduled/:id', async (req, res) => {
        try {
            const { ScheduleService } = await import('../services/schedule.service.js');
            await ScheduleService.deleteSchedule(req.params.id);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/scheduled/:id/pause', async (req, res) => {
        try {
            const { ScheduleService } = await import('../services/schedule.service.js');
            await ScheduleService.stopSchedule(req.params.id);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/scheduled/:id/resume', async (req, res) => {
        try {
            const { ScheduleService } = await import('../services/schedule.service.js');
            await ScheduleService.resumeSchedule(req.params.id);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/', async (req, res) => {
        display(req, res);
    });

    app.post('/api/send', async (req, res) => {
        const { username, message } = req.body;
        const extractedUsername = extractUsername(username);
        const result = await NGLService.sendMessage(extractedUsername, message);

        // Track the result in stats
        await StatsService.logResult(extractedUsername, message, result.success);

        res.json(result);
    });

    app.get('/api/stats', async (req, res) => {
        const stats = await StatsService.getStats();
        res.json({
            messagesSent: stats.messagesSent,
            failedRequests: stats.failedRequests,
            uniqueVictims: stats.uniqueVictims,
            uptime: stats.uptime,
            proxyCount: ProxyService.proxies.length,
            activeAttacks: AttackService.getActiveCount()
        });
    });

    app.get('/api/victims', async (req, res) => {
        // Optimization: Limit to top 50 active/recent victims to prevent huge payloads
        const victims = await StatsService.getVictimDetails(50);

        // Inject active status and timing data
        const now = Date.now();
        for (const username in victims) {
            if (AttackService.activeAttacks.has(username)) {
                const attackState = AttackService.activeAttacks.get(username);
                victims[username].isActive = true;
                victims[username].startTime = attackState.startTime;
                victims[username].endTime = attackState.endTime;
                victims[username].rps = attackState.rps;
                victims[username].duration = attackState.duration;
                victims[username].isPaused = attackState.paused;

                if (attackState.paused) {
                    // If paused, remaining time is fixed based on when it was paused
                    const effectiveElapsed = (attackState.pauseStartTime - attackState.startTime - attackState.totalPausedTime) / 1000;
                    victims[username].elapsedSeconds = Math.floor(effectiveElapsed);
                    victims[username].remainingSeconds = Math.max(0, Math.floor(attackState.duration - effectiveElapsed));
                } else {
                    const effectiveElapsed = (now - attackState.startTime - attackState.totalPausedTime) / 1000;
                    victims[username].elapsedSeconds = Math.floor(effectiveElapsed);
                    victims[username].remainingSeconds = Math.max(0, Math.floor(attackState.duration - effectiveElapsed));
                }
            } else {
                victims[username].isActive = false;
            }
        }

        res.json(victims);
    });

    app.get('/api/victims/:username/proxies', async (req, res) => {
        const { username } = req.params;
        if (!username) return res.status(400).json({ error: 'Username required' });

        try {
            const proxies = await StatsService.getProxiesForVictim(extractUsername(username));
            res.json(proxies);
        } catch (error) {
            console.error('Error fetching proxies for victim:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/attack/stop', async (req, res) => {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });

        const stopped = await AttackService.stopAttack(extractUsername(username), 'WEB_USER', 'Web Dashboard');
        if (stopped) {
            io.emit('attack_stopped', { username }); // Notify clients
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Attack not found or already stopped' });
        }
    });

    app.post('/api/attack/pause', async (req, res) => {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });

        const paused = await AttackService.pauseAttack(extractUsername(username));
        if (paused) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Attack not found or not active' });
        }
    });

    app.post('/api/attack/start', async (req, res) => {
        const { username, type, rps, duration, message, count, messageLimit } = req.body;

        if (!username) return res.status(400).json({ error: 'Username required' });
        if (!type) return res.status(400).json({ error: 'Type required (spam/bomb)' });

        const extractedUsername = extractUsername(username);
        // Use a placeholder user ID for web dashboard actions
        const userId = 'WEB_DASHBOARD';
        const userTag = 'Web Admin';

        try {
            if (type === 'spam') {
                const messages = message ? message.split('|') : ['Hello'];
                const msgLimit = parseInt(messageLimit) || null; // null = unlimited (time-based)
                const result = await AttackService.startSpam(
                    extractedUsername,
                    messages,
                    parseInt(rps) || 50,
                    parseInt(duration) || 60,
                    userId,
                    userTag,
                    null,     // No channel ID for web
                    msgLimit  // Total message limit (optional)
                );

                if (result.success) {
                    res.json({ success: true });
                } else {
                    res.status(400).json({ error: result.message });
                }
            } else if (type === 'bomb') {
                const successCount = await AttackService.sendBomb(
                    extractedUsername,
                    message || 'Hello',
                    parseInt(count) || 10,
                    userId,
                    userTag,
                    10, // Batch size
                    null // No channel ID
                );

                if (successCount > 0) {
                    res.json({ success: true, count: successCount });
                } else {
                    res.status(400).json({ error: 'Bomb attack failed' });
                }
            } else {
                res.status(400).json({ error: 'Invalid attack type' });
            }
        } catch (error) {
            console.error('Attack start error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/attack/resume', async (req, res) => {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });

        const resumed = await AttackService.resumeAttack(extractUsername(username));
        if (resumed) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Attack not found or not paused' });
        }
    });

    app.post('/api/attack/stop-all', async (req, res) => {
        const activeAttacks = Array.from(AttackService.activeAttacks.keys());
        let stoppedCount = 0;

        for (const username of activeAttacks) {
            const stopped = await AttackService.stopAttack(username, 'WEB_USER', 'Web Dashboard - Stop All');
            if (stopped) stoppedCount++;
        }

        io.emit('all_attacks_stopped', { count: stoppedCount });
        res.json({ success: true, stopped: stoppedCount });
    });

    app.post('/api/victims/note', async (req, res) => {
        const { username, note } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });

        await StatsService.saveNote(extractUsername(username), note);
        res.json({ success: true });
    });

    app.post('/api/check-proxies', requireAdmin, async (req, res) => {
        try {
            // Trigger a reload from sources and DB
            await ProxyService.loadProxies();
            
            // Return current stats
            const stats = await ProxyService.getStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/proxies/fetch', requireAdmin, async (req, res) => {
        try {
            await ProxyService.loadProxies();
            const stats = await ProxyService.getStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/proxies/refresh', requireAdmin, async (req, res) => {
        try {
            await ProxyService.refreshProxiesFromDB();
            const stats = await ProxyService.getStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Template endpoints
    app.get('/api/templates', (req, res) => {
        res.json(TemplateService.getAll());
    });

    app.get('/api/templates/:id/preview', (req, res) => {
        const { id } = req.params;
        const count = parseInt(req.query.count) || 5;
        const messages = TemplateService.getRandomMessages(id, count);
        res.json({ messages });
    });

    // Queue endpoints
    app.get('/api/queue', (req, res) => {
        res.json(QueueService.getStatus());
    });

    app.post('/api/queue/pause', (req, res) => {
        QueueService.pause();
        res.json({ success: true });
    });

    app.post('/api/queue/resume', (req, res) => {
        QueueService.resume();
        res.json({ success: true });
    });

    app.post('/api/queue/clear', (req, res) => {
        const count = QueueService.clear();
        res.json({ success: true, cleared: count });
    });

    // Proxy stats endpoint
    app.get('/api/proxy-stats', async (req, res) => {
        const stats = await ProxyService.getStats();
        res.json({ 
            total: stats.total, 
            alive: stats.working, 
            dead: stats.failed, 
            topPerformers: [] 
        });
    });

    // Enhanced stats endpoint with historical data
    app.get('/api/stats/detailed', async (req, res) => {
        const stats = await StatsService.getStats();
        const victimDetails = await StatsService.getVictimDetails();
        const proxyStats = { alive: 0 };
        const queueStatus = await QueueService.getStatus();

        res.json({
            messagesSent: stats.messagesSent,
            failedRequests: stats.failedRequests,
            successRate: stats.messagesSent > 0 ?
                ((stats.messagesSent / (stats.messagesSent + stats.failedRequests)) * 100).toFixed(1) : 0,
            uniqueVictims: stats.uniqueVictims,
            uptime: stats.uptime,
            proxyCount: proxyStats.alive,
            activeAttacks: AttackService.getActiveCount(),
            queueLength: queueStatus.queued,
            topVictims: Object.entries(victimDetails)
                .sort((a, b) => b[1].messageCount - a[1].messageCount)
                .slice(0, 5)
                .map(([username, data]) => ({ username, count: data.messageCount }))
        });
    });



    const server = httpServer.listen(port, () => {
        console.log("Listening on port:", port);
        console.log(`Access the app browser\nhttp://localhost:${port}`);
    });

    // Graceful shutdown
    const shutdown = () => {
        console.log('Shutting down...');
        // StatsService.save() is no longer needed with DB
        server.close(() => {
            console.log('Server closed.');
            process.exit(0);
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

