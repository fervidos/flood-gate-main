import 'dotenv/config';
import cluster from 'cluster';
import os from 'os';
import { startServer } from '../src/web/server.js';
import { connectDB } from '../src/db/mongo.js';
import { QueueService } from '../src/services/queue.service.js';
import { ProxyService } from '../src/services/proxy.service.js';
import { WorkerMessageHandler } from '../src/worker/message-handler.js';
import { StatsService } from '../src/services/stats.service.js';
import { AttackService } from '../src/services/attack.service.js';

console.log('Imports loaded. Attempting connection...');

async function main() {
    try {
        await connectDB();
        console.log('SUCCESS: Connected to DB');
        process.exit(0);
    } catch (error) {
        console.error('FAILURE:', error);
        process.exit(1);
    }
}
main();
