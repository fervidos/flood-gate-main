import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default fallback user agents
const defaultUserAgents = [
    // Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",

    // macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0",

    // Linux
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",

    // Mobile - iOS
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",

    // Mobile - Android
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36"
];

let userAgents = [...defaultUserAgents];
let loadedFromFile = false;

import cluster from 'cluster';

try {
    const userAgentsPath = path.join(__dirname, '../../generated_user_agents.txt');
    if (fs.existsSync(userAgentsPath)) {
        if (cluster.isPrimary) {
            console.log('Loading user agents from file...');
        }
        const fileContent = fs.readFileSync(userAgentsPath, 'utf-8');
        const fileUserAgents = fileContent.split('\n')
            .map(ua => ua.trim())
            .filter(ua => ua.length > 0);

        if (fileUserAgents.length > 0) {
            userAgents = fileUserAgents;
            loadedFromFile = true;
            if (cluster.isPrimary) {
                console.log(`Loaded ${userAgents.length} user agents from file.`);
            }
        }
    } else {
        if (cluster.isPrimary) {
            console.warn('generated_user_agents.txt not found, using default list.');
        }
    }
} catch (error) {
    console.error('Error loading user agents from file:', error);
}

export function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}
