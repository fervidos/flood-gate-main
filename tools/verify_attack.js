import { connectDB, disconnectDB } from '../src/db/mongo.js';
import { Victim } from '../src/db/models/Victim.js';
import { AttackSession } from '../src/db/models/AttackSession.js';
import { RequestLog } from '../src/db/models/RequestLog.js';

async function verify() {
    await connectDB();
    try {
        console.log("Checking Victim 'test'...");
        const victim = await Victim.findOne({ username: 'test' });
        console.log('Victim:', victim ? 'FOUND' : 'NOT FOUND');
        if (victim) {
            console.log('Stats:', victim.stats);
        }

        console.log("Checking Active Sessions...");
        const sessions = await AttackSession.find({ victimUsername: 'test' }).sort({ startTime: -1 }).limit(1);
        console.log(`Found ${sessions.length} sessions for 'test'.`);
        if (sessions.length > 0) {
            console.log('Latest Session:', sessions[0].status);
        }

        console.log("Checking Request Logs...");
        const logCount = await RequestLog.countDocuments({ target: 'test' });
        console.log(`Found ${logCount} request logs for 'test'.`);

    } catch (e) {
        console.error(e);
    } finally {
        await disconnectDB();
    }
}
verify();
