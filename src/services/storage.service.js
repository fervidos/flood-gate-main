import { LastAttack } from '../db/models/LastAttack.js';

// Deprecated generic StorageService removed.


export const LastAttackService = {
    async init() {
        // No-op
    },

    async get(userId) {
        const doc = await LastAttack.findOne({ userId });
        if (!doc) return null;

        return {
            username: doc.username,
            messages: doc.messages,
            rps: doc.rps,
            duration: doc.duration
        };
    },

    async set(userId, params) {
        await LastAttack.findOneAndUpdate(
            { userId },
            {
                userId,
                username: params.username,
                messages: params.messages, // Mongoose handles array
                rps: params.rps,
                duration: params.duration,
                updatedAt: new Date()
            },
            { upsert: true }
        );
    }
};

// Initialize on load
LastAttackService.init();
