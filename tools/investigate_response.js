/**
 * Response Size Investigation Script
 * Checks what NGL actually returns to understand high download bandwidth
 */

import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const PROXY_URL = 'http://cannabass:LdreuNbxxdjR_8863Y@dc.decodo.com:10000';
const TEST_URL = 'https://ngl.link/api/submit';

const payload = {
    username: 'testuser123',
    question: 'Test message',
    deviceId: 'abc123test',
    gameSlug: '',
    referrer: 'https://ngl.link/'
};

const headers = {
    'Host': 'ngl.link',
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://ngl.link',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Accept': '*/*',
    'Referer': 'https://ngl.link/',
    'Accept-Encoding': 'gzip, deflate, br',
};

async function investigateResponse() {
    console.log('🔍 Investigating NGL Response Sizes...\n');

    const proxyAgent = new HttpsProxyAgent(PROXY_URL);

    try {
        // Make a test request and capture full response details
        const response = await axios.post(TEST_URL, payload, {
            headers,
            httpsAgent: proxyAgent,
            timeout: 15000,
            maxRedirects: 5,  // Allow redirects to see what happens
            validateStatus: () => true  // Accept any status
        });

        console.log('=== RESPONSE DETAILS ===');
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`\nResponse Headers:`);

        for (const [key, value] of Object.entries(response.headers)) {
            console.log(`  ${key}: ${value}`);
        }

        // Calculate response size
        const responseData = typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);

        const responseSize = Buffer.byteLength(responseData, 'utf8');
        const headerSize = Object.entries(response.headers)
            .reduce((sum, [k, v]) => sum + k.length + String(v).length + 4, 0);

        console.log(`\n=== SIZE ANALYSIS ===`);
        console.log(`Response Body Size: ${responseSize} bytes (${(responseSize / 1024).toFixed(2)} KB)`);
        console.log(`Response Headers Size: ~${headerSize} bytes`);
        console.log(`Content-Length Header: ${response.headers['content-length'] || 'Not set'}`);
        console.log(`Content-Encoding: ${response.headers['content-encoding'] || 'None (uncompressed)'}`);

        console.log(`\n=== RESPONSE BODY (first 500 chars) ===`);
        console.log(responseData.substring(0, 500));

        if (responseData.length > 500) {
            console.log(`\n... (${responseData.length - 500} more characters)`);
        }

        // Check for redirects
        if (response.request._redirectable?._redirectCount > 0) {
            console.log(`\n⚠️ REDIRECTS DETECTED: ${response.request._redirectable._redirectCount}`);
        }

    } catch (error) {
        console.log('Error:', error.message);
        if (error.response) {
            console.log('Error Response Status:', error.response.status);
            console.log('Error Response Data:', error.response.data?.substring?.(0, 500) || error.response.data);
        }
    }

    proxyAgent.destroy();
}

investigateResponse().catch(console.error);
