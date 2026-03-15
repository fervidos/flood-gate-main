/**
 * Bandwidth Test Script
 * Tests before/after socket optimization impact on proxy bandwidth
 * 
 * Usage: node tools/bandwidth_test.js
 */

import axios from 'axios';
import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Proxy configuration (same as your main app)
const PROXY_URL = 'http://cannabass:LdreuNbxxdjR_8863Y@dc.decodo.com:10000';

// Test configurations
const TEST_CONFIGS = {
    before: {
        name: 'BEFORE (High Sockets)',
        maxSockets: 10000,
        maxFreeSockets: 1000,
        keepAliveMsecs: 30000
    },
    after: {
        name: 'AFTER (Optimized)',
        maxSockets: 50,
        maxFreeSockets: 25,
        keepAliveMsecs: 60000
    }
};

// Test parameters
const TEST_URL = 'https://ngl.link/api/submit';
const NUM_REQUESTS = 100;  // Number of requests per test
const CONCURRENCY = 20;    // Concurrent requests

// Simulated request payload (similar to actual app)
const createPayload = () => ({
    username: 'testuser',
    question: 'Test message for bandwidth testing',
    deviceId: Math.random().toString(36).substring(2, 12),
    gameSlug: '',
    referrer: 'https://ngl.link/'
});

const headers = {
    'Host': 'ngl.link',
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://ngl.link',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Accept': '*/*',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Referer': 'https://ngl.link/',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9'
};

async function runTest(config) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Running: ${config.name}`);
    console.log(`Settings: maxSockets=${config.maxSockets}, maxFreeSockets=${config.maxFreeSockets}`);
    console.log(`${'='.repeat(50)}`);

    // Create agents with test config
    const proxyAgent = new HttpsProxyAgent(PROXY_URL);

    const httpsAgent = new https.Agent({
        keepAlive: true,
        keepAliveMsecs: config.keepAliveMsecs,
        maxSockets: config.maxSockets,
        maxFreeSockets: config.maxFreeSockets,
        timeout: 15000
    });

    const axiosInstance = axios.create({
        httpsAgent: proxyAgent,
        timeout: 10000,
        maxRedirects: 0
    });

    const results = {
        success: 0,
        failed: 0,
        totalLatency: 0,
        startTime: Date.now()
    };

    // Process requests in batches
    const batches = Math.ceil(NUM_REQUESTS / CONCURRENCY);

    for (let batch = 0; batch < batches; batch++) {
        const batchStart = batch * CONCURRENCY;
        const batchEnd = Math.min(batchStart + CONCURRENCY, NUM_REQUESTS);
        const batchSize = batchEnd - batchStart;

        const promises = [];
        for (let i = 0; i < batchSize; i++) {
            const startTime = Date.now();
            const promise = axiosInstance.post(TEST_URL, createPayload(), { headers })
                .then(response => {
                    results.success++;
                    results.totalLatency += Date.now() - startTime;
                })
                .catch(error => {
                    results.failed++;
                    results.totalLatency += Date.now() - startTime;
                });
            promises.push(promise);
        }

        await Promise.all(promises);

        // Progress update
        const progress = Math.round((batchEnd / NUM_REQUESTS) * 100);
        process.stdout.write(`\rProgress: ${progress}% (${batchEnd}/${NUM_REQUESTS})`);
    }

    const totalTime = (Date.now() - results.startTime) / 1000;
    const avgLatency = Math.round(results.totalLatency / NUM_REQUESTS);
    const rps = (NUM_REQUESTS / totalTime).toFixed(1);

    console.log('\n');
    console.log(`Results for ${config.name}:`);
    console.log(`  Total Requests: ${NUM_REQUESTS}`);
    console.log(`  Success: ${results.success}`);
    console.log(`  Failed: ${results.failed}`);
    console.log(`  Total Time: ${totalTime.toFixed(2)}s`);
    console.log(`  Average Latency: ${avgLatency}ms`);
    console.log(`  Effective RPS: ${rps}`);

    // Cleanup
    proxyAgent.destroy();

    return {
        ...results,
        totalTime,
        avgLatency,
        rps: parseFloat(rps)
    };
}

async function main() {
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║     Bandwidth Optimization Test Script             ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║  Test URL: ${TEST_URL.substring(0, 38)}...  ║`);
    console.log(`║  Requests: ${NUM_REQUESTS} | Concurrency: ${CONCURRENCY}                  ║`);
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('\n⚠️  NOTE: Check your proxy provider dashboard before and');
    console.log('    after each test to see actual bandwidth usage!\n');

    // Wait for user confirmation
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to start...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Run BEFORE test
    const beforeResults = await runTest(TEST_CONFIGS.before);

    console.log('\n⏳ Waiting 10 seconds before next test...');
    console.log('   (Check proxy dashboard for "BEFORE" bandwidth now!)');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Run AFTER test  
    const afterResults = await runTest(TEST_CONFIGS.after);

    // Summary
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║                  COMPARISON SUMMARY                ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║  BEFORE (High Sockets):                            ║`);
    console.log(`║    RPS: ${beforeResults.rps.toString().padEnd(8)} Latency: ${beforeResults.avgLatency}ms`.padEnd(53) + '║');
    console.log(`║  AFTER (Optimized):                                ║`);
    console.log(`║    RPS: ${afterResults.rps.toString().padEnd(8)} Latency: ${afterResults.avgLatency}ms`.padEnd(53) + '║');
    console.log('╠════════════════════════════════════════════════════╣');

    const rpsDiff = ((afterResults.rps - beforeResults.rps) / beforeResults.rps * 100).toFixed(1);
    const latencyDiff = ((afterResults.avgLatency - beforeResults.avgLatency) / beforeResults.avgLatency * 100).toFixed(1);

    console.log(`║  RPS Change: ${rpsDiff}%`.padEnd(53) + '║');
    console.log(`║  Latency Change: ${latencyDiff}%`.padEnd(53) + '║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log('║  ⚠️  Check proxy dashboard for bandwidth savings!  ║');
    console.log('╚════════════════════════════════════════════════════╝');
}

main().catch(console.error);
