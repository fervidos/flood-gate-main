import mongoose from 'mongoose';

const AttackParamSchema = new mongoose.Schema({
    _id: String, // We use generated short IDs
    username: String,
    messages: [String], // Array of strings
    rps: Number,
    duration: Number,
    timestamp: { type: Number, default: Date.now },
    userId: String, // Optional owner
    userTag: String // Optional owner tag
});

// Auto-expire after 24 hours (86400 seconds)
AttackParamSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });

export const AttackParam = mongoose.model('AttackParam', AttackParamSchema);
