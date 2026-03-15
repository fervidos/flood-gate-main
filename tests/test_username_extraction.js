import { extractUsername } from '../src/utils/username.js';

console.log('Testing extractUsername utility...\n');

const testCases = [
    { input: 'rasp_berry54can', expected: 'rasp_berry54can' },
    { input: 'https://ngl.link/rasp_berry54can', expected: 'rasp_berry54can' },
    { input: 'http://ngl.link/rasp_berry54can', expected: 'rasp_berry54can' },
    { input: 'ngl.link/rasp_berry54can', expected: 'rasp_berry54can' },
    { input: 'www.ngl.link/rasp_berry54can', expected: 'rasp_berry54can' },
    { input: 'https://ngl.link/TestUser123', expected: 'testuser123' },
    { input: 'UPPERCASE', expected: 'uppercase' },
    { input: '  https://ngl.link/user_with_spaces  ', expected: 'user_with_spaces' },
    { input: 'https://ngl.link/user?query=param', expected: 'user' },
    { input: 'https://ngl.link/user#fragment', expected: 'user' },
];

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected }) => {
    const result = extractUsername(input);
    const status = result === expected ? '✓' : '✗';

    if (result === expected) {
        passed++;
        console.log(`${status} PASS: "${input}" => "${result}"`);
    } else {
        failed++;
        console.log(`${status} FAIL: "${input}" => "${result}" (expected: "${expected}")`);
    }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
