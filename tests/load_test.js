
import { AttackService } from '../src/services/attack.service.js';
import { StatsService } from '../src/services/stats.service.js';
import { UserService } from '../src/services/user.service.js';
import { ProxyService } from '../src/services/proxy.service.js';

// ============================================
// LOAD TEST CONFIGURATION
// ============================================
const CONFIG = {
    USERS: 5,                    // Number of simulated Discord users
    COMMANDS_PER_USER: 3,        // Commands each user will execute
    VICTIMS_PER_COMMAND: 2,      // Number of victims per command
    RPS_MIN: 10,                 // Minimum RPS per command
    RPS_MAX: 50,                 // Maximum RPS per command
    DURATION_MIN: 15,            // Minimum duration (seconds)
    DURATION_MAX: 30,            // Maximum duration (seconds)
    DELAY_BETWEEN_COMMANDS: 2000 // Delay between commands per user (ms)
};

// Track test stats (but don't mock StatsService so UI gets updated)
const testStats = {
    sent: 0,
    failed: 0,
    startTime: 0,
    totalCommands: 0,
    victimCounter: 1  // Global victim counter for sequential names
};

// Override only the increment methods to track our local stats
const originalIncrementSent = StatsService.incrementSent;
const originalIncrementFailed = StatsService.incrementFailed;

StatsService.incrementSent = function (count = 1) {
    testStats.sent += count;
    return originalIncrementSent.call(this, count);
};

StatsService.incrementFailed = function (count = 1) {
    testStats.failed += count;
    return originalIncrementFailed.call(this, count);
};

// Mock UserService to avoid disk I/O
UserService.logActivity = () => { };
UserService.save = async () => { };

// Utility function to get random value in range
function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simulate a single Discord user executing multiple commands
async function simulateDiscordUser(userId) {
    console.log(`[Discord User ${userId}] Starting simulation with ${CONFIG.COMMANDS_PER_USER} commands`);

    for (let cmdIdx = 0; cmdIdx < CONFIG.COMMANDS_PER_USER; cmdIdx++) {
        const rps = randomRange(CONFIG.RPS_MIN, CONFIG.RPS_MAX);
        const duration = randomRange(CONFIG.DURATION_MIN, CONFIG.DURATION_MAX);

        // Each command targets multiple victims with simple sequential names
        const victims = [];
        for (let v = 0; v < CONFIG.VICTIMS_PER_COMMAND; v++) {
            victims.push(`user${testStats.victimCounter++}`);
        }

        const messages = [
            `Test message from Discord user ${userId}`,
            `Hello from load test!`,
            `Attack ${cmdIdx + 1}`
        ];

        console.log(`[Discord User ${userId}] Command ${cmdIdx + 1}/${CONFIG.COMMANDS_PER_USER}:`);
        console.log(`  └─ Victims: ${victims.join(', ')} | ${rps} RPS | ${duration}s`);

        // Launch attacks on all victims for this command
        for (const victim of victims) {
            testStats.totalCommands++;

            AttackService.startSpam(
                victim,
                messages,
                rps,
                duration,
                `discord_${userId}`,
                `LoadTest User ${userId}`
            );
        }

        // Wait before next command (simulate realistic Discord user behavior)
        if (cmdIdx < CONFIG.COMMANDS_PER_USER - 1) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_COMMANDS));
        }
    }

    console.log(`[Discord User ${userId}] ✅ All commands launched\n`);
}

async function runLoadTest() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║      FloodGate Load Test - Discord Simulation (UI)        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const totalVictims = CONFIG.USERS * CONFIG.COMMANDS_PER_USER * CONFIG.VICTIMS_PER_COMMAND;

    console.log('Configuration:');
    console.log(`  • Discord Users: ${CONFIG.USERS}`);
    console.log(`  • Commands per user: ${CONFIG.COMMANDS_PER_USER}`);
    console.log(`  • Victims per command: ${CONFIG.VICTIMS_PER_COMMAND}`);
    console.log(`  • Total attacks: ${CONFIG.USERS * CONFIG.COMMANDS_PER_USER * CONFIG.VICTIMS_PER_COMMAND}`);
    console.log(`  • Victim naming: user1, user2, user3...user${totalVictims}`);
    console.log(`  • RPS range: ${CONFIG.RPS_MIN}-${CONFIG.RPS_MAX}`);
    console.log(`  • Duration range: ${CONFIG.DURATION_MIN}-${CONFIG.DURATION_MAX}s`);
    console.log(`  • Delay between commands: ${CONFIG.DELAY_BETWEEN_COMMANDS}ms\n`);

    console.log('Loading proxies...');
    const proxyCount = ProxyService.loadProxies();
    console.log(`Loaded ${proxyCount} proxies.\n`);

    console.log('⚠️  NOTE: This test will update the UI dashboard in real-time!\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    testStats.startTime = Date.now();

    // Launch all Discord users concurrently
    const userPromises = [];
    for (let i = 0; i < CONFIG.USERS; i++) {
        userPromises.push(simulateDiscordUser(i + 1));
    }

    console.log('All Discord users launched. Monitoring progress...\n');

    // Monitor progress
    const monitorInterval = setInterval(() => {
        const elapsed = (Date.now() - testStats.startTime) / 1000;
        const currentRps = (testStats.sent + testStats.failed) / elapsed;
        const successRate = testStats.sent + testStats.failed > 0
            ? ((testStats.sent / (testStats.sent + testStats.failed)) * 100).toFixed(1)
            : 0;

        console.log(`[${elapsed.toFixed(1)}s] 📊 Sent: ${testStats.sent} | Failed: ${testStats.failed} | RPS: ${currentRps.toFixed(1)} | Success: ${successRate}%`);
    }, 2000);

    // Wait for all users to complete their command sequences
    await Promise.all(userPromises);

    // Calculate max expected duration
    const maxDuration = CONFIG.DURATION_MAX + (CONFIG.COMMANDS_PER_USER * CONFIG.DELAY_BETWEEN_COMMANDS / 1000);

    // Wait for all attacks to complete
    console.log(`\nWaiting ${maxDuration + 3}s for all attacks to complete...\n`);
    await new Promise(resolve => setTimeout(resolve, (maxDuration + 3) * 1000));

    clearInterval(monitorInterval);

    const totalTime = (Date.now() - testStats.startTime) / 1000;
    const totalRequests = testStats.sent + testStats.failed;
    const finalRps = totalRequests / totalTime;
    const successRate = totalRequests > 0
        ? ((testStats.sent / totalRequests) * 100).toFixed(2)
        : 0;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                   Load Test Results                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Commands:');
    console.log(`  • Total attacks launched: ${testStats.totalCommands}`);
    console.log(`  • Expected attacks: ${totalVictims}`);
    console.log(`  • Unique victims: user1 through user${totalVictims}\n`);

    console.log('Requests:');
    console.log(`  • Total requests: ${totalRequests}`);
    console.log(`  • Successful: ${testStats.sent} (${successRate}%)`);
    console.log(`  • Failed: ${testStats.failed} (${(100 - successRate).toFixed(2)}%)\n`);

    console.log('Performance:');
    console.log(`  • Total duration: ${totalTime.toFixed(2)}s`);
    console.log(`  • Average RPS: ${finalRps.toFixed(2)}`);
    const expectedAvgRps = (CONFIG.RPS_MIN + CONFIG.RPS_MAX) / 2 * CONFIG.VICTIMS_PER_COMMAND * CONFIG.USERS;
    console.log(`  • Expected peak RPS: ~${expectedAvgRps.toFixed(2)}\n`);

    // Calculate efficiency
    const avgRps = (CONFIG.RPS_MIN + CONFIG.RPS_MAX) / 2;
    const avgDuration = (CONFIG.DURATION_MIN + CONFIG.DURATION_MAX) / 2;
    const theoreticalTotal = avgRps * avgDuration * testStats.totalCommands;
    const efficiency = (totalRequests / theoreticalTotal) * 100;

    console.log('Efficiency:');
    console.log(`  • Theoretical max requests: ~${theoreticalTotal.toFixed(0)}`);
    console.log(`  • Actual requests: ${totalRequests}`);
    console.log(`  • Efficiency: ${efficiency.toFixed(2)}%\n`);

    console.log('UI Dashboard:');
    console.log(`  • Check the web dashboard to see all victims!`);
    console.log(`  • Unique victims tracked: ${StatsService.getUniqueVictimsCount()}\n`);

    console.log('═══════════════════════════════════════════════════════════\n');

    // Save final stats
    await StatsService.save();
    console.log('✅ Stats saved to disk. Check the dashboard!\n');

    process.exit(0);
}

runLoadTest();
