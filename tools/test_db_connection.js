import dotenv from 'dotenv';
dotenv.config();
import { connectDB, disconnectDB } from '../src/db/mongo.js';

const testConnection = async () => {
    console.log('Testing MongoDB Connection...');
    try {
        await connectDB();
        console.log('Test Connection Successful!');
        await disconnectDB();
        process.exit(0);
    } catch (error) {
        console.error('Test Connection Failed:', error);
        process.exit(1);
    }
};

testConnection();
