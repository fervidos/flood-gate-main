import mongoose from 'mongoose';

const LastAttackSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    username: String,
    messages: [String],
    rps: Number,
    duration: Number,
    updatedAt: { type: Date, default: Date.now }
});

export const LastAttack = mongoose.model('LastAttack', LastAttackSchema);
