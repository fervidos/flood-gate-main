import mongoose from 'mongoose';

const RequestLogSchema = new mongoose.Schema({
    sessionId: { type: String, index: true },
    timestamp: { type: Date, default: Date.now, expires: 86400 }, // TTL index: 24h
    target: { type: String, index: true },
    proxy: String,
    statusCode: Number,
    responseTime: Number,
    outcome: String,
    errorDetails: Object
});

export const RequestLog = mongoose.model('RequestLog', RequestLogSchema);
