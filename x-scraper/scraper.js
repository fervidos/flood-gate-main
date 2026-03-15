const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrape(keyword, proxies, logCallback, tweetCallback) {
    logCallback(`Starting scrape for keyword: "${keyword}"`);

    let proxy = null;
    if (proxies.length > 0) {
        proxy = proxies[Math.floor(Math.random() * proxies.length)];
        logCallback(`Using proxy: ${proxy}`);
    } else {
        logCallback('No proxies available, running locally (risky)');
    }

    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
    ];

    let browser;
    try {
        if (proxy) {
            try {
                // Ensure the proxy string is a valid URL for parsing
                const proxyUrl = new URL(proxy.startsWith('http') || proxy.startsWith('https') ? proxy : `http://${proxy}`);
                const { username, password, hostname, port, protocol } = proxyUrl;

                // Puppeteer expects --proxy-server=protocol://host:port
                // Note: URL.protocol includes ':', so we remove it for the arg.
                args.push(`--proxy-server=${protocol.replace(':', '')}://${hostname}:${port}`);

                logCallback(`Configuring proxy: ${hostname}:${port}`);

                browser = await puppeteer.launch({
                    headless: "new",
                    args: args
                });

                const page = await browser.newPage();

                // Authenticate if credentials exist
                if (username && password) {
                    logCallback('Authenticating proxy...');
                    await page.authenticate({ username, password });
                }

                // Anti-detection: Set User-Agent
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                // 1. Navigate to Twitter Search
                // We try "Latest" (f=live), but guests are often redirected.
                const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;
                logCallback(`Navigating to: ${searchUrl}`);

                await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

                // 2. Check for login wall or content
                const title = await page.title();
                logCallback(`Page title: ${title}`);

                // 3. Wait for tweets to load
                try {
                    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
                } catch (e) {
                    logCallback('Timeout waiting for tweets. Might be login walled or proxy blocked.');

                    // Check for login prompt
                    const loginSelector = 'div[data-testid="login"]'; // hypothetical
                    const isLogin = await page.$(loginSelector);
                    if (isLogin) logCallback('Detected Login Wall.');
                }

                // 4. Extract data
                const tweets = await page.evaluate(() => {
                    const tweetNodes = document.querySelectorAll('article[data-testid="tweet"]');
                    const results = [];
                    tweetNodes.forEach(node => {
                        try {
                            const text = node.innerText;
                            const userElement = node.querySelector('div[data-testid="User-Name"]');
                            const timestampElement = node.querySelector('time');

                            const user = userElement ? userElement.innerText.split('\n')[0] : 'Unknown';
                            const handle = userElement ? userElement.innerText.split('\n')[1] : 'Unknown';
                            const time = timestampElement ? timestampElement.getAttribute('datetime') : new Date().toISOString();

                            results.push({ user, handle, text, time });
                        } catch (err) {
                            // skip malformed
                        }
                    });
                    return results;
                });

                logCallback(`Found ${tweets.length} tweets.`);
                tweets.forEach(t => tweetCallback(t));

            } catch (error) {
                logCallback(`Error configuring proxy or scraping: ${error.message}`);
            }
        } else {
            // Fallback for no proxy (local) - kept for safety, though unlikely to be hit
            logCallback('No proxy configured, running without proxy.');
            browser = await puppeteer.launch({ headless: "new", args });
            const page = await browser.newPage();

            // Anti-detection: Set User-Agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // 1. Navigate to Twitter Search
            const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;
            logCallback(`Navigating to: ${searchUrl}`);

            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // 2. Check for login wall or content
            const title = await page.title();
            logCallback(`Page title: ${title}`);

            // 3. Wait for tweets to load
            try {
                await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
            } catch (e) {
                logCallback('Timeout waiting for tweets. Might be login walled.');
                const loginSelector = 'div[data-testid="login"]';
                const isLogin = await page.$(loginSelector);
                if (isLogin) logCallback('Detected Login Wall.');
            }

            // 4. Extract data
            const tweets = await page.evaluate(() => {
                const tweetNodes = document.querySelectorAll('article[data-testid="tweet"]');
                const results = [];
                tweetNodes.forEach(node => {
                    try {
                        const text = node.innerText;
                        const userElement = node.querySelector('div[data-testid="User-Name"]');
                        const timestampElement = node.querySelector('time');

                        const user = userElement ? userElement.innerText.split('\n')[0] : 'Unknown';
                        const handle = userElement ? userElement.innerText.split('\n')[1] : 'Unknown';
                        const time = timestampElement ? timestampElement.getAttribute('datetime') : new Date().toISOString();

                        results.push({ user, handle, text, time });
                    } catch (err) {
                        // skip malformed
                    }
                });
                return results;
            });

            logCallback(`Found ${tweets.length} tweets.`);
            tweets.forEach(t => tweetCallback(t));
        }
    } catch (error) {
        logCallback(`Error during Puppeteer execution: ${error.message}`);
    } finally {
        if (browser) await browser.close();
        logCallback('Browser closed.');
    }
}

module.exports = { scrape };

