import { ScheduledAttack } from '../db/models/ScheduledAttack.js';
import { QueueService } from './queue.service.js';

class ScheduleManager {
    constructor() {
        this.timer = null;
    }

    start() {
        if (this.timer) clearInterval(this.timer);
        console.log('[SCHEDULE] Starting periodic scheduler (1m interval)');
        // Run every 60 seconds
        this.timer = setInterval(() => this.tick(), 60000);
        // Also run immediately on boot
        setTimeout(() => this.tick(), 2000);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async tick() {
        try {
            const now = new Date();
            // Find schedules that are active and due (nextRun is in the past)
            const dueSchedules = await ScheduledAttack.find({
                status: 'active',
                nextRun: { $lte: now }
            });

            if (dueSchedules.length > 0) {
                console.log(`[SCHEDULE] Polled ${dueSchedules.length} due attacks.`);
            }

            for (const schedule of dueSchedules) {
                console.log(`[SCHEDULE] Triggering schedule ${schedule.id} for ${schedule.username}`);

                // Queue the attack
                await QueueService.add({
                    type: 'spam',
                    username: schedule.username,
                    userId: schedule.userId,
                    userTag: schedule.userTag,
                    messages: schedule.messages,
                    rps: 25, // Fixed RPS for stability
                    duration: 3600, // Safe ceiling
                    priority: 5 // Optional: elevate priority?
                });

                // Advance nextRun
                schedule.lastRun = now;
                schedule.nextRun = new Date(now.getTime() + schedule.intervalMinutes * 60000);
                await schedule.save();
            }
        } catch (error) {
            console.error('[SCHEDULE] Error during tick:', error);
        }
    }

    async createSchedule(data) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        // Start immediately by default
        const nextRun = new Date();

        const schedule = await ScheduledAttack.create({
            id,
            userId: data.userId || 'system',
            userTag: data.userTag || 'Web Admin',
            username: data.username,
            messages: data.messages,
            amount: data.amount,
            intervalMinutes: data.intervalMinutes,
            nextRun
        });
        
        return schedule;
    }

    async listSchedules() {
        return ScheduledAttack.find().sort({ createdAt: -1 }).lean();
    }

    async stopSchedule(id) {
        return ScheduledAttack.findOneAndUpdate({ id }, { status: 'paused' });
    }

    async resumeSchedule(id) {
        return ScheduledAttack.findOneAndUpdate({ id }, { status: 'active', nextRun: new Date() });
    }

    async deleteSchedule(id) {
        return ScheduledAttack.findOneAndDelete({ id });
    }
}

export const ScheduleService = new ScheduleManager();
