import { ProxyService } from './src/services/proxy.service.js';
import { NGLService } from './src/services/ngl.service.js';

async function test() {
    console.log('Testing ProxyService...');
    await ProxyService.loadProxies();
    
    if (ProxyService.proxies.length === 0) {
        console.error('❌ No proxies loaded!');
        return;
    }
    
    console.log(`✅ Loaded ${ProxyService.proxies.length} proxies.`);
    
    const proxy = ProxyService.getNextProxy();
    console.log('Sample Proxy:', proxy);
    
    const agent = ProxyService.getAgent(proxy);
    if (agent) {
        console.log('✅ Agent created successfully.');
    } else {
        console.error('❌ Failed to create agent.');
    }

    console.log('Testing NGLService integration...');
    // We will just call sendMessage and see if it tries to use a proxy
    // Since we can't easily spy on axios without mocking, we'll rely on the previous code review.
    // But we can check if it throws an immediate error.
    
    try {
        console.log('Attempting to send message with proxy...');
        const result = await NGLService.sendMessage('test_user', 'test message');
        console.log('Result:', result);
    } catch (e) {
        console.error('Error during send:', e);
    }
}

test();
