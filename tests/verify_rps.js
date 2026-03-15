
import { AttackService } from '../src/services/attack.service.js';
import { NGLService } from '../src/services/ngl.service.js';
import { StatsService } from '../src/services/stats.service.js';
import { UserService } from '../src/services/user.service.js';

// Mock dependencies
NGLService.sendMessage = async () => { return { success: true }; };
StatsService.trackVictim = () => { };
StatsService.logMessage = () => { };
StatsService.logResult = () => { };
UserService.logActivity = () => { };

async function testRPS(targetRps, duration) {
    console.log(`Testing ${targetRps} RPS for ${duration} seconds...`);

    // Mock NGLService.sendMessage to count calls
    let callCount = 0;
    NGLService.sendMessage = async () => {
        callCount++;
        return { success: true };
    };

    const startTime = Date.now();
    await AttackService.startSpam('test_user', ['msg'], targetRps, duration, 'user_id', 'user_tag');

    // Wait for the attack to finish (plus a small buffer)
    await new Promise(resolve => setTimeout(resolve, (duration * 1000) + 200));

    // We use the configured duration because the attack service is designed to stop exactly at that time.
    const effectiveDuration = duration;
    const actualRps = callCount / effectiveDuration;

    console.log(`Total sent: ${callCount}`);
    console.log(`Target sent: ${targetRps * duration}`);
    console.log(`Effective RPS: ${actualRps.toFixed(2)}`);

    const error = Math.abs(actualRps - targetRps);
    const percentError = (error / targetRps) * 100;

    console.log(`Error: ${percentError.toFixed(2)}%`);

    if (percentError < 5) {
        console.log('PASSED');
    } else {
        console.log('FAILED');
    }
    console.log('---');
}

async function runTests() {
    await testRPS(5, 2);
    await testRPS(10, 2);
    await testRPS(15, 2);
    await testRPS(50, 2);
}

runTests();
