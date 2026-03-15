import mongoose from 'mongoose';

const proxySchema = new mongoose.Schema({
    host: {
        type: String,
        required: true
    },
    port: {
        type: Number,
        required: true
    },
    auth: {
        type: String, // username:password
        default: null
    },
    type: {
        type: String,
        enum: ['http', 'socks4', 'socks5'],
        default: 'socks5'
    },
    failCount: {
        type: Number,
        default: 0
    },
    timeoutUntil: {
        type: Date,
        default: null
    },
    lastChecked: {
        type: Date,
        default: Date.now
    },
    isWorking: {
        type: Boolean,
        default: true
    },
    source: {
        type: String,
        default: 'unknown'
    }
}, {
    timestamps: true
});

// Composite index for uniqueness
proxySchema.index({ host: 1, port: 1 }, { unique: true });

// Index for efficient querying of working proxies
proxySchema.index({ isWorking: 1, timeoutUntil: 1 });

export const Proxy = mongoose.model('Proxy', proxySchema);
