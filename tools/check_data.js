import 'dotenv/config';
import { connectDB, disconnectDB } from '../src/db/mongo.js';
import { Victim } from '../src/db/models/Victim.js';

async function checkData() {
    try {
        await connectDB();
        const count = await Victim.countDocuments();
        console.log(`Victim count: ${count}`);

        if (count > 0) {
            const sample = await Victim.findOne().lean();
            console.log('Sample victim:', JSON.stringify(sample, null, 2));
        }
    } catch (error) {
        console.error('Error checking data:', error);
    } finally {
        await disconnectDB();
        process.exit(0);
    }
}

checkData();
