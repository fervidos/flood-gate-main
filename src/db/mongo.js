import mongoose from 'mongoose';

const MONGODB_URL = process.env.MONGODB_URI || 'mongodb+srv://cannabass:LaNIsGay6969@cluster0.daerxo.mongodb.net/?appName=Cluster0';
const DB_NAME = 'FloodGate_DB'; // Override the Unzipper_Bot name for this project

export const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URL, {
            dbName: DB_NAME,
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

export const disconnectDB = async () => {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
};
