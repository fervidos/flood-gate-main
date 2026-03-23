import mongoose from 'mongoose';
import { Proxy } from '../src/db/models/Proxy.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load environment variables *before* connecting
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URL = process.env.MONGODB_URI;

async function resetProxies() {
    try {
        if (!MONGODB_URL) throw new Error("MONGODB_URI not set in .env");
        
        await mongoose.connect(MONGODB_URL, {
            dbName: 'FloodGate_DB',
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ MongoDB Connected');
        console.log('Resetting all proxies...');
        
        const result = await Proxy.updateMany({}, {
            $set: {
                failCount: 0,
                timeoutUntil: null,
                isWorking: true,
                lastChecked: new Date()
            }
        });
        
        console.log(`Successfully reset ${result.modifiedCount} proxies.`);
    } catch (error) {
        console.error('Error resetting proxies:', error);
    } finally {
        await mongoose.disconnect();
    }
}

resetProxies();
