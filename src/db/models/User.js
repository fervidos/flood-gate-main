import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema({
    action: String,
    details: String,
    timestamp: Date
}, { _id: false });

const UserSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Using String ID (Discord ID) manually
    username: { type: String, default: 'Unknown' },
    password: { type: String }, // Hashed password for local login
    role: { type: String, default: 'user', enum: ['user', 'admin'] },
    allowed: { type: Boolean, default: false },
    tokens: { type: Number, default: 0 },
    limits: {
        maxRps: { type: Number, default: 10 },
        maxDuration: { type: Number, default: 60 }
    },
    lastSeen: Date,
    attacksLaunched: { type: Number, default: 0 },
    activityLogs: [ActivityLogSchema]
}, {
    _id: false, // Don't auto-generate _id if we are setting it manually, but Mongoose usually handles custom _id ok.
    // Actually, if we set _id in schema, we need to be careful. 
    // Using `{ _id: String }` above is correct for manual string IDs.
    timestamps: true
});

export const User = mongoose.model('User', UserSchema);
