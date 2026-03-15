import { AttackService } from './attack.service.js';
import { NotificationService } from './notification.service.js';
import { QueueItem } from '../db/models/QueueItem.js';

/**
 * Attack Queue Service
 * Manages queued attacks using Mongo persistence
 */

class AttackQueue {
    constructor() {
        this.processing = false;
        this.currentAttack = null;
        this.paused = false;
        this.queue = [];
    }

    async loadFromDb() {
        try {
            const pending = await QueueItem.find({ status: 'queued' })
                .sort({ priority: -1, addedAt: 1 })
                .lean();

            if (pending.length > 0) {
                console.log(`[QUEUE] Loaded ${pending.length} items from database`);
                // Standardize keys from DB to memory
                this.queue = pending.map(item => ({
                    ...item,
                    id: item._id, // Map _id to id
                    user_id: item.userId,
                    user_tag: item.userTag
                }));
                this.processNext();
            }
        } catch (error) {
            console.error('[QUEUE] Failed to load from DB:', error);
        }
    }

    async add(attackData) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const { type, username, userId, userTag, priority = 0 } = attackData;

        let payload = {};
        if (type === 'spam') {
            payload = {
                messages: attackData.messages,
                rps: attackData.rps,
                duration: attackData.duration
            };
        } else if (type === 'bomb') {
            payload = {
                message: attackData.message,
                count: attackData.count,
                concurrency: attackData.concurrency || 10
            };
        }

        // Create Mongoose Document
        const item = {
            id, // We use this for internal ref, validation might need strict handling
            _id: id,
            type,
            username,
            payload,
            priority,
            status: 'queued',
            userId,
            userTag,
            addedAt: new Date()
        };

        await QueueItem.create(item);

        // Memory State
        const memItem = {
            ...item,
            user_id: userId,
            user_tag: userTag
        };

        this.queue.push(memItem);
        this.sortQueue();

        if (!this.processing && !this.paused) {
            this.processNext();
        }
        return memItem;
    }

    sortQueue() {
        this.queue.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            return new Date(a.addedAt) - new Date(b.addedAt);
        });
    }

    async processNext() {
        if (this.processing || this.paused || this.queue.length === 0) return;

        this.processing = true;
        const item = this.queue.shift();
        this.currentAttack = item;

        // Lock in DB
        await QueueItem.findByIdAndUpdate(item.id, { status: 'processing' });

        console.log(`[QUEUE] Processing attack: ${item.username} (${item.type})`);

        try {
            if (item.type === 'spam') {
                const { messages, rps, duration } = item.payload;
                await AttackService.startSpam(item.username, messages, rps, duration, item.userId, item.userTag);
                setTimeout(async () => {
                    await this.completeAttack(item);
                }, duration * 1000);
            } else if (item.type === 'bomb') {
                const { message, count, concurrency } = item.payload;
                await AttackService.sendBomb(item.username, message, count, item.userId, item.userTag, concurrency);
                await this.completeAttack(item);
            }
        } catch (error) {
            console.error('Queue processing error:', error);
            await QueueItem.findByIdAndUpdate(item.id, { status: 'failed' }); // Keep failed record?
            this.currentAttack = null;
            this.processing = false;
            this.processNext();
        }
    }

    async completeAttack(item) {
        await QueueItem.findByIdAndDelete(item.id);

        this.currentAttack = null;
        this.processing = false;
        console.log(`[QUEUE] Completed: ${item.username}`);

        if (this.queue.length === 0) {
            NotificationService.notifyQueueComplete(item.userId, { completed: 1, failed: 0 }, null);
        }

        this.processNext();
    }

    async getStatus() {
        return {
            queued: this.queue.length,
            processing: this.processing,
            paused: this.paused,
            current: this.currentAttack,
            queue: this.queue
        };
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
        if (!this.processing) this.processNext();
    }

    async clear() {
        const count = this.queue.length;
        this.queue = [];
        await QueueItem.deleteMany({ status: 'queued' });
        return count;
    }

    async remove(id) {
        const index = this.queue.findIndex(i => i.id === id);
        if (index !== -1) {
            const item = this.queue[index];
            this.queue.splice(index, 1);
            await QueueItem.findByIdAndDelete(id);
            return item;
        }
        return null;
    }
}

export const QueueService = new AttackQueue();

