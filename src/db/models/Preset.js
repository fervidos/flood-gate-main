import mongoose from 'mongoose';

const PresetSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    config: {
        rps: Number,
        duration: Number,
        template: String,
        messages: [String]
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Composite unique index
PresetSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Preset = mongoose.model('Preset', PresetSchema);
