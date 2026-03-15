import mongoose from 'mongoose';

const bannedProxySchema = new mongoose.Schema({
    host: {
        type: String,
        required: true
    },
    port: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        default: 'Excessive failures'
    },
    bannedAt: {
        type: Date,
        default: Date.now
    }
});

// Composite index for uniqueness
bannedProxySchema.index({ host: 1, port: 1 }, { unique: true });

export const BannedProxy = mongoose.model('BannedProxy', bannedProxySchema);
