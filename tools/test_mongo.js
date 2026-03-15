import mongoose from 'mongoose';

const MONGODB_URL = 'mongodb+srv://salesianpaolo_db_user:yc8ofFu9jh6YyBcF@cluster0.iqtgyyo.mongodb.net/?retryWrites=true&w=majority';
const DB_NAME = 'FloodGate_DB';

async function testConnection() {
    try {
        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect(MONGODB_URL, {
            dbName: DB_NAME,
            serverSelectionTimeoutMS: 5000 // 5 seconds timeout
        });
        console.log('✅ MongoDB Connected Successfully!');
        await mongoose.disconnect();
        console.log('Disconnected');
    } catch (error) {
        console.error('❌ MongoDB Connection Failed:');
        console.error(error);
    }
}

testConnection();
