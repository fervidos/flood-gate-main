import { User } from '../db/models/User.js';

export const UserService = {
    async getUser(userId) {
        let user = await User.findById(userId);
        const isOwner = userId === process.env.OWNER_ID;

        if (!user) {
            // Create new user (using default schema values where possible)
            user = await User.create({
                _id: userId,
                username: 'Unknown',
                allowed: isOwner,
                tokens: isOwner ? -1 : 0, // -1 means Infinity for us
                limits: {
                    maxRps: isOwner ? 1000 : 10,
                    maxDuration: isOwner ? 3600 : 60
                },
                lastSeen: new Date(),
                attacksLaunched: 0
            });
        } else if (isOwner) {
            // Ensure owner permissions
            if (!user.allowed || user.tokens !== -1) {
                user.allowed = true;
                user.tokens = -1; // Wait, our schema says Number. -1 is fine.
                user.limits.maxRps = 1000;
                user.limits.maxDuration = 3600;
                await user.save();
            }
        }

        return this._transform(user);
    },

    async isAllowed(userId) {
        const user = await this.getUser(userId);
        return user.allowed;
    },

    async grantAccess(userId) {
        await User.updateOne({ _id: userId }, { allowed: true });
        return true;
    },

    async revokeAccess(userId) {
        if (userId === process.env.OWNER_ID) return false;
        await User.updateOne({ _id: userId }, { allowed: false });
        return true;
    },

    async hasTokens(userId, cost = 1) {
        const user = await this.getUser(userId);
        return user.tokens === Infinity || (user.tokens !== undefined && (user.tokens === -1 || user.tokens >= cost));
    },

    async deductTokens(userId, amount = 1) {
        const user = await User.findById(userId);
        if (!user) return false;

        if (user.tokens === -1) return true; // Infinite tokens

        if (user.tokens >= amount) {
            user.tokens -= amount;
            await user.save();
            return true;
        }
        return false;
    },

    async addTokens(userId, amount) {
        const user = await User.findById(userId);
        if (user && user.tokens !== -1) {
            user.tokens += amount;
            await user.save();
            return user.tokens;
        }
        return Infinity;
    },

    async setLimits(userId, rps, duration) {
        const update = {};
        if (rps) update["limits.maxRps"] = rps;
        if (duration) update["limits.maxDuration"] = duration;

        if (Object.keys(update).length > 0) {
            await User.updateOne({ _id: userId }, { $set: update });
        }

        const user = await this.getUser(userId);
        return user.limits;
    },

    async logActivity(userId, username, action, details) {
        const now = new Date();
        const update = {
            $set: { username: username, lastSeen: now },
            $push: {
                activityLogs: {
                    action,
                    details,
                    timestamp: now
                }
            }
        };

        if (action === 'ATTACK_START' || action === 'BOMB') {
            update.$inc = { attacksLaunched: 1 };
        }

        await User.updateOne({ _id: userId }, update, { upsert: true });
    },

    _transform(doc) {
        return {
            id: doc._id,
            username: doc.username,
            allowed: doc.allowed,
            tokens: doc.tokens === -1 ? Infinity : doc.tokens,
            limits: {
                maxRps: doc.limits?.maxRps || 10,
                maxDuration: doc.limits?.maxDuration || 60
            },
            attacksLaunched: doc.attacksLaunched,
            lastSeen: doc.lastSeen
        };
    }
};
