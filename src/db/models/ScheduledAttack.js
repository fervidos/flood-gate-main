import mongoose from 'mongoose';

const ScheduledAttackSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Internal ID
    userId: { type: String, required: true },
    userTag: { type: String, default: 'Web Admin' },
    username: { type: String, required: true }, // Target
    messages: { type: [String], required: true }, // Payloads to rotate
    amount: { type: Number, required: true }, // Messages to send per interval
    intervalMinutes: { type: Number, required: true }, // Run every X minutes
    lastRun: { type: Date, default: null },
    nextRun: { type: Date, required: true },
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

export const ScheduledAttack = mongoose.model('ScheduledAttack', ScheduledAttackSchema);
