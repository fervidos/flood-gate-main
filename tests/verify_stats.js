
import { StatsService } from '../src/services/stats.service.js';

// Mock NGLService to avoid actual network calls
const NGLService = {
    sendMessage: async (username, message) => {
        return { success: true };
    }
};

async function verifyStats() {
    console.log('Starting stats verification...');

    const username = 'test_victim_1';
    const message = 'Hello World';

    // Simulate successful message
    console.log('Logging successful message...');
    StatsService.logResult(username, message, true);

    // Simulate failed message
    console.log('Logging failed message...');
    StatsService.logResult(username, message, false);

    // Check stats
    const victimData = StatsService.data.victimDetails[username.toLowerCase()];

    if (!victimData) {
        console.error('❌ Victim data not found!');
        process.exit(1);
    }

    console.log('Victim Data:', JSON.stringify(victimData, null, 2));

    // Verify global stats
    if (victimData.stats.success !== 1 || victimData.stats.failed !== 1) {
        console.error('❌ Global stats incorrect!');
        process.exit(1);
    } else {
        console.log('✅ Global stats correct.');
    }

    // Verify message counts
    const msgStats = victimData.messageCounts[message];
    if (!msgStats || msgStats.success !== 1 || msgStats.failed !== 1) {
        console.error('❌ Message counts incorrect!');
        process.exit(1);
    } else {
        console.log('✅ Message counts correct.');
    }

    // Verify recent activity
    if (victimData.messages.length !== 2) {
        console.error('❌ Recent activity length incorrect!');
        process.exit(1);
    } else {
        console.log('✅ Recent activity length correct.');
    }

    console.log('Verification complete!');
}

verifyStats();
