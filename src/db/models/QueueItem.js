import mongoose from 'mongoose';

const QueueItemSchema = new mongoose.Schema({
    _id: String, // Keep string ID compatibility
    type: String,
    username: String,
    payload: Object,
    priority: { type: Number, default: 0 },
    status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued' },
    userId: String,
    userTag: String,
    scheduleId: String,
    addedAt: { type: Date, default: Date.now }
});

export const QueueItem = mongoose.model('QueueItem', QueueItemSchema);
