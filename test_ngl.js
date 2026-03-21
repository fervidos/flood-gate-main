import { NGLService } from './src/services/ngl.service.js';

async function test() {
    console.log("Testing NGL request...");
    const res = await NGLService.sendMessage("testuser", "test message", 0);
    console.log("Result:", res);
}

test();
