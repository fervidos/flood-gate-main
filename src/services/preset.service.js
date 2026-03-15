import { Preset } from '../db/models/Preset.js';

export const PresetService = {
    async save(userId, presetName, config) {
        const update = {
            userId,
            name: presetName,
            config: {
                rps: config.rps,
                duration: config.duration,
                template: config.template || null,
                messages: config.messages || []
            },
            updatedAt: new Date()
        };

        // Upsert
        const result = await Preset.findOneAndUpdate(
            { userId, name: presetName },
            {
                $set: update,
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true, new: true }
        );

        // Normalize return
        return this._transform(result);
    },

    async load(userId, presetName) {
        const preset = await Preset.findOne({ userId, name: presetName });
        return preset ? this._transform(preset) : null;
    },

    async getAll(userId) {
        const rows = await Preset.find({ userId });
        const presets = {};
        rows.forEach(row => {
            presets[row.name] = this._transform(row);
        });
        return presets;
    },

    async delete(userId, presetName) {
        const result = await Preset.deleteOne({ userId, name: presetName });
        return result.deletedCount > 0;
    },

    async exists(userId, presetName) {
        return !!(await Preset.exists({ userId, name: presetName }));
    },

    _transform(doc) {
        return {
            name: doc.name,
            rps: doc.config.rps,
            duration: doc.config.duration,
            template: doc.config.template,
            messages: doc.config.messages,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    },

    // Deprecated
    async update(userId, presetName, updates) {
        const current = await this.load(userId, presetName);
        if (!current) throw new Error('Preset not found');
        return this.save(userId, presetName, { ...current, ...updates });
    },
    async getCount(userId) {
        return await Preset.countDocuments({ userId });
    }
};


