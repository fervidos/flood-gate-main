import mongoose from 'mongoose';

const VictimSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, index: true },
    firstSeen: Date,
    lastSeen: Date,
    note: String,
    stats: {
        success: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        attackCount: { type: Number, default: 0 }
    },
    messageStats: [{
        content: String,
        success: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        lastSent: Date
    }],
    recentMessages: [{
        content: String,
        success: Boolean,
        timestamp: Date
    }]
});

export const Victim = mongoose.model('Victim', VictimSchema);
