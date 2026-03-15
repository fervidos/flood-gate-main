import mongoose from 'mongoose';

const AttackSessionSchema = new mongoose.Schema({
    _id: String, // Use string ID to match existing UUIDs if needed, or let Mongo generate ObjectId and map it
    victimUsername: { type: String, index: true },
    startTime: Date,
    endTime: Date,
    status: String,
    params: Object,
    stats: {
        totalSent: { type: Number, default: 0 },
        success: { type: Number, default: 0 },
        failed: { type: Number, default: 0 }
    },
    proxyStats: { type: Object, default: {} } // proxy url -> request count
});

export const AttackSession = mongoose.model('AttackSession', AttackSessionSchema);
