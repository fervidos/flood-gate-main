import 'dotenv/config';
import os from 'os';
import { startServer } from './web/server.js';
import { connectDB } from './db/mongo.js';
import { QueueService } from './services/queue.service.js';
import { StatsService } from './services/stats.service.js';
import { AttackService } from './services/attack.service.js';
import { ProxyService } from './services/proxy.service.js';
import { AuthService } from './services/auth.service.js';

async function main() {
    try {
        console.log(`[System] Process ${process.pid} starting...`);

        // Initialize DB
        await connectDB();
        await AuthService.initAdmin();
        await QueueService.loadFromDb();

        // Load Proxies
        await ProxyService.loadProxies();

        // Start periodic stats reporting
        setInterval(() => {
            const attackStats = AttackService.getAndResetStats();
            // We can't use await inside setInterval easily without wrapper, but firing it is okay
            StatsService.processBufferedStats({ attack: attackStats }).catch(console.error);
        }, 1000);

        // Start Web Server
        startServer();

    } catch (error) {
        console.error('Failed to start application:', error);
        process.exit(1);
    }
}

main();
