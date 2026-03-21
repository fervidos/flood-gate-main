/**
 * Unit Tests for Attack Service
 */

import { jest } from '@jest/globals';
import { AttackService } from '../../src/services/attack.service.js';
import { NGLService } from '../../src/services/ngl.service.js';
import { StatsService } from '../../src/services/stats.service.js';
import { UserService } from '../../src/services/user.service.js';

// Mock dependencies
jest.mock('../../src/services/ngl.service.js');
jest.mock('../../src/services/stats.service.js');
jest.mock('../../src/services/user.service.js');

describe('AttackService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        AttackService.activeAttacks.clear();

        // Setup default mocks
        StatsService.trackVictim = jest.fn();
        StatsService.logMessage = jest.fn();
        UserService.logActivity = jest.fn();
        NGLService.sendMessage = jest.fn().mockResolvedValue({ success: true, status: 200 });
    });

    describe('sendBomb', () => {
        it('should send messages concurrently', async () => {
            const count = 50;
            const successCount = await AttackService.sendBomb(
                'testuser',
                'test message',
                count,
                'user123',
                'TestUser#1234',
                10
            );

            expect(successCount).toBe(count);
            expect(NGLService.sendMessage).toHaveBeenCalledTimes(count);
            expect(StatsService.trackVictim).toHaveBeenCalledWith('testuser');
            expect(UserService.logActivity).toHaveBeenCalledWith(
                'user123',
                'TestUser#1234',
                'BOMB',
                expect.stringContaining('testuser')
            );
        });

        it('should handle partial failures', async () => {
            NGLService.sendMessage = jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockResolvedValueOnce({ success: false })
                .mockResolvedValueOnce({ success: true });

            const successCount = await AttackService.sendBomb(
                'testuser',
                'test',
                3,
                'user123',
                'TestUser#1234'
            );

            expect(successCount).toBe(2);
        });

        it('should respect concurrency limits', async () => {
            let concurrentCalls = 0;
            let maxConcurrent = 0;

            NGLService.sendMessage = jest.fn().mockImplementation(async () => {
                concurrentCalls++;
                maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
                await new Promise(resolve => setTimeout(resolve, 10));
                concurrentCalls--;
                return { success: true };
            });

            await AttackService.sendBomb('testuser', 'test', 50, 'user123', 'TestUser#1234', 5);

            expect(maxConcurrent).toBeLessThanOrEqual(5);
        });
    });

    describe('startSpam', () => {
        it('should prevent duplicate attacks on same user', async () => {
            const result1 = await AttackService.startSpam(
                'testuser',
                ['msg1', 'msg2'],
                10,
                5,
                'user123',
                'TestUser#1234'
            );

            const result2 = await AttackService.startSpam(
                'testuser',
                ['msg1', 'msg2'],
                10,
                5,
                'user123',
                'TestUser#1234'
            );

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(false);
            expect(result2.message).toContain('already active');
        });

        it('should track active attacks', async () => {
            await AttackService.startSpam(
                'user1',
                ['msg'],
                10,
                5,
                'user123',
                'TestUser#1234'
            );

            expect(AttackService.getActiveCount()).toBe(1);
        });
    });

    describe('stopAttack', () => {
        it('should stop an active attack', async () => {
            await AttackService.startSpam(
                'testuser',
                ['msg'],
                10,
                5,
                'user123',
                'TestUser#1234'
            );

            const stopped = AttackService.stopAttack('testuser', 'user123', 'TestUser#1234');

            expect(stopped).toBe(true);
            expect(AttackService.getActiveCount()).toBe(0);
        });

        it('should return false for non-existent attack', () => {
            const stopped = AttackService.stopAttack('nonexistent', 'user123', 'TestUser#1234');
            expect(stopped).toBe(false);
        });
    });

    describe('getActiveCount', () => {
        it('should return correct count of active attacks', async () => {
            expect(AttackService.getActiveCount()).toBe(0);

            await AttackService.startSpam('user1', ['msg'], 10, 5, 'user123', 'TestUser#1234');
            await AttackService.startSpam('user2', ['msg'], 10, 5, 'user123', 'TestUser#1234');

            expect(AttackService.getActiveCount()).toBe(2);
        });
    });
});
