import { connectDB, disconnectDB } from '../src/db/mongo.js';
import { UserService } from '../src/services/user.service.js';
import { LastAttackService } from '../src/services/storage.service.js';

async function verify() {
    try {
        await connectDB();
        console.log('DB Connected.');

        // 1. Verify User Service
        console.log('Testing UserService...');
        const ownerId = '1226079373264650250'; // Sales's ID from common logs, or just pick one existing from migration
        // Let's use a dummy ID first to test creation, then an existing one.

        const testId = 'verify_test_user';
        const user = await UserService.getUser(testId);
        console.log('Fetched/Created User:', user.username);

        await UserService.logActivity(testId, 'VerifyScript', 'TEST_ACTION', 'Testing migration');
        console.log('Logged activity.');

        const userAfter = await UserService.getUser(testId);
        console.log('User Last Seen:', userAfter.lastSeen);

        // 2. Verify Last Attack Service
        console.log('Testing LastAttackService...');
        await LastAttackService.set(testId, {
            username: 'target_dummy',
            messages: ['msg1', 'msg2'],
            rps: 50,
            duration: 120
        });
        console.log('Set Last Attack.');

        const last = await LastAttackService.get(testId);
        console.log('Fetched Last Attack:', last);

        if (last.username === 'target_dummy' && last.rps === 50) {
            console.log('✅ LastAttack verification passed.');
        } else {
            console.error('❌ LastAttack verification failed.');
        }

        console.log('✅ Verification Script Finished Successfully.');
    } catch (e) {
        console.error('Verification failed:', e);
    } finally {
        await disconnectDB();
    }
}

verify();
