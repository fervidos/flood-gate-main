import { NGLService } from '../src/services/ngl.service.js';

console.log('Testing NGLService Headers...');

try {
    const userAgent = 'Mozilla/5.0 (Test UA)';
    const headers = NGLService.getRandomHeaders(userAgent);

    console.log('Headers generated:', headers);

    if (headers['User-Agent'] === userAgent && headers['Referer'] && headers['Referer'].startsWith('https://')) {
        console.log('SUCCESS: Headers look correct.');
    } else {
        console.error('FAILURE: Headers are missing or incorrect.');
        process.exit(1);
    }
} catch (error) {
    console.error('Error during verification:', error);
    process.exit(1);
}
