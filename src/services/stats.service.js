import { Victim } from '../db/models/Victim.js';
import { RequestLog } from '../db/models/RequestLog.js';
import { AttackSession } from '../db/models/AttackSession.js';

// Helper to calculate total uptime (simple start time tracking)
const startTime = Date.now();

export const StatsService = {
    async getStats() {
        // Aggregate stats across all victims
        const result = await Victim.aggregate([
            {
                $group: {
                    _id: null,
                    messagesSent: { $sum: "$stats.success" },
                    failedRequests: { $sum: "$stats.failed" },
                    uniqueVictims: { $sum: 1 }
                }
            }
        ]);

        const data = result[0] || { messagesSent: 0, failedRequests: 0, uniqueVictims: 0 };
        return {
            ...data,
            uptime: Date.now() - startTime
        };
    },

    async getVictimDetails(limit = 50) {
        const victims = await Victim.find({}).sort({ lastSeen: -1 }).limit(limit).lean();

        const details = {};
        for (const v of victims) {
            // Transform Mongoose format to match Frontend expected structure
            const messageCounts = {};
            if (v.messageStats) {
                v.messageStats.forEach(m => {
                    messageCounts[m.content] = {
                        success: m.success,
                        failed: m.failed,
                        lastSent: m.lastSent
                    };
                });
            }

            details[v.username] = {
                firstSeen: v.firstSeen,
                lastSeen: v.lastSeen,
                attackCount: v.stats?.attackCount || 0,
                note: v.note,
                stats: {
                    success: v.stats?.success || 0,
                    failed: v.stats?.failed || 0
                },
                messageCounts: messageCounts
            };
        }
        return details;
    },

    async trackVictim(username) {
        // Find or create victim
        const lowerUser = username.toLowerCase();
        await Victim.findOneAndUpdate(
            { username: lowerUser },
            {
                $setOnInsert: { firstSeen: new Date() },
                $set: { lastSeen: new Date() }
            },
            { upsert: true, new: true }
        );
    },

    async incrementAttackCount(username) {
        await Victim.findOneAndUpdate(
            { username: username.toLowerCase() },
            { $inc: { "stats.attackCount": 1 } },
            { upsert: true }
        );
    },

    async logResult(username, message, isSuccess) {
        const lowerUser = username.toLowerCase();
        const now = new Date();
        const incField = isSuccess ? "stats.success" : "stats.failed";
        const msgIncField = isSuccess ? "messageStats.$.success" : "messageStats.$.failed";

        // 1. Update global victim stats and try to update existing message stats
        const updateResult = await Victim.updateOne(
            { username: lowerUser, "messageStats.content": message },
            {
                $set: { lastSeen: now, "messageStats.$.lastSent": now },
                $inc: { [incField]: 1, [msgIncField]: 1 },
                $push: {
                    recentMessages: {
                        $each: [{ content: message, success: isSuccess, timestamp: now }],
                        $slice: -20 // Keep last 20
                    }
                }
            }
        );

        // 2. If message stat didn't exist (updateResult.modifiedCount would be 0 or matchedCount 0 if we assume victim exists), 
        // we might need to add it.
        // But simpler strategy: just Try update, if not modified, then push new message stat.
        // Actually, just findOneAndUpdate with specific logic is easier but tricky with array element match.

        if (updateResult.matchedCount === 0) {
            // Victim likely doesn't exist, create it
            await Victim.updateOne(
                { username: lowerUser },
                {
                    $set: { lastSeen: now, firstSeen: now },
                    $inc: { [incField]: 1 },
                    $push: {
                        messageStats: {
                            content: message,
                            success: isSuccess ? 1 : 0,
                            failed: isSuccess ? 0 : 1,
                            lastSent: now
                        },
                        recentMessages: {
                            $each: [{ content: message, success: isSuccess, timestamp: now }],
                            $slice: -20
                        }
                    }
                },
                { upsert: true }
            );
        } else if (updateResult.modifiedCount === 0) {
            // Victim exists but message content not in array yet
            await Victim.updateOne(
                { username: lowerUser },
                {
                    $push: {
                        messageStats: {
                            content: message,
                            success: isSuccess ? 1 : 0,
                            failed: isSuccess ? 0 : 1,
                            lastSent: now
                        }
                    }
                    // recentMessages already pushed in first try if victim matched? 
                    // No, if "messageStats.content" didn't match, the whole first query might fail to match if we structured it that way.
                    // Actually, the first query: { username: lowerUser, "messageStats.content": message }
                    // If message is new, this query returns 0 matches.
                    // So we need to do the Update Victim Stats + Push Message in a secondary step.
                }
            );
            // Re-apply the global stats increment if the first query missed
            // This logic is getting complex. Let's simplify.

            // Simplification:
            // Always update victim-level stats and push recent message
            await Victim.updateOne(
                { username: lowerUser },
                {
                    $set: { lastSeen: now },
                    $inc: { [incField]: 1 },
                    $push: {
                        recentMessages: {
                            $each: [{ content: message, success: isSuccess, timestamp: now }],
                            $slice: -20
                        }
                    }
                },
                { upsert: true }
            );

            // Then handles message-specific stats
            const msgStatUpdate = await Victim.updateOne(
                { username: lowerUser, "messageStats.content": message },
                {
                    $set: { "messageStats.$.lastSent": now },
                    $inc: { [msgIncField]: 1 }
                }
            );

            if (msgStatUpdate.matchedCount === 0) {
                await Victim.updateOne(
                    { username: lowerUser },
                    {
                        $push: {
                            messageStats: {
                                content: message,
                                success: isSuccess ? 1 : 0,
                                failed: isSuccess ? 0 : 1,
                                lastSent: now
                            }
                        }
                    }
                );
            }
        }
    },

    async saveNote(username, note) {
        await Victim.updateOne(
            { username: username.toLowerCase() },
            { $set: { note: note } },
            { upsert: true }
        );
    },

    async createAttackSession(sessionData) {
        const { id, victim_username, start_time, params } = sessionData;
        await AttackSession.create({
            _id: id,
            victimUsername: victim_username,
            startTime: start_time,
            status: 'ACTIVE',
            params: params,
            stats: { totalSent: 0, success: 0, failed: 0 }
        });
    },

    async updateAttackSession(id, data) {
        const { status, total_sent, success_count, fail_count, end_time } = data;
        const updates = {};
        if (status) updates.status = status;
        if (end_time) updates.endTime = end_time;
        if (total_sent !== undefined) updates["stats.totalSent"] = total_sent;
        if (success_count !== undefined) updates["stats.success"] = success_count;
        if (fail_count !== undefined) updates["stats.failed"] = fail_count;

        if (Object.keys(updates).length > 0) {
            await AttackSession.findByIdAndUpdate(id, { $set: updates });
        }
    },

    async logRequest(requestData) {
        const { session_id, timestamp, target, proxy, status_code, response_time_ms, outcome, error_details } = requestData;
        // Fire and forget
        RequestLog.create({
            sessionId: session_id,
            timestamp: timestamp,
            target: target,
            proxy: proxy,
            statusCode: status_code,
            responseTime: response_time_ms,
            outcome: outcome,
            errorDetails: error_details
        }).catch(err => console.error('Failed to log request:', err));
    },

    async getProxiesForVictim(username) {
        const lowerUser = username.toLowerCase();
        // 1. Find sessions for this victim
        // Fetch proxyStats from all sessions
        const sessions = await AttackSession.find({ victimUsername: lowerUser }).select('proxyStats startTime');

        const proxyMap = {};

        for (const session of sessions) {
            if (session.proxyStats) {
                // If using lean(), it's a plain object. If mongoose doc, it's a Map.
                const entries = session.proxyStats instanceof Map ? session.proxyStats.entries() : Object.entries(session.proxyStats);

                for (const [safeKey, count] of entries) {
                    // Restore key
                    const originalKey = safeKey.replace(/_/g, '.');

                    if (!proxyMap[originalKey]) {
                        proxyMap[originalKey] = { count: 0, last_used: session.startTime }; // approx last used
                    }
                    proxyMap[originalKey].count += count;
                    // Keep most recent session time
                    if (new Date(session.startTime) > new Date(proxyMap[originalKey].last_used)) {
                        proxyMap[originalKey].last_used = session.startTime;
                    }
                }
            }
        }

        return Object.entries(proxyMap)
            .map(([proxy, data]) => ({
                proxy: proxy,
                count: data.count,
                last_used: data.last_used
            }))
            .sort((a, b) => b.count - a.count);
    },

    async getTopVictims(limit = 5) {
        // Efficiently get top victims by total message count
        return await Victim.aggregate([
            {
                $addFields: {
                    totalMessages: { $add: [{ $ifNull: ["$stats.success", 0] }, { $ifNull: ["$stats.failed", 0] }] }
                }
            },
            { $sort: { totalMessages: -1 } },
            { $limit: limit },
            {
                $project: {
                    username: 1,
                    count: "$totalMessages"
                }
            }
        ]);
    },

    async updateMessageStat(username, message, successCount, failedCount) {
        const lowerUser = username.toLowerCase();
        const now = new Date();

        const result = await Victim.updateOne(
            { username: lowerUser, "messageStats.content": message },
            {
                $inc: {
                    "messageStats.$.success": successCount,
                    "messageStats.$.failed": failedCount
                },
                $set: { "messageStats.$.lastSent": now }
            }
        );

        if (result.matchedCount === 0) {
            await Victim.updateOne(
                { username: lowerUser },
                {
                    $push: {
                        messageStats: {
                            content: message,
                            success: successCount,
                            failed: failedCount,
                            lastSent: now
                        }
                    }
                }
            );
        }
    },

    // Simplified aggregation for single process (called primarily by main loop)
    async processBufferedStats(payload) {
        if (payload.attack) {
            const workerStats = payload.attack;
            // 1. Update individual victim stats
            for (const [username, stats] of Object.entries(workerStats.details)) {
                if (stats.s > 0 || stats.f > 0) {

                    // Create recent messages entries from stats.m
                    const recentMsgs = [];
                    if (stats.m) {
                        for (const [msg, counts] of Object.entries(stats.m)) {
                            recentMsgs.push({
                                content: msg,
                                success: counts.s > 0,
                                timestamp: new Date()
                            });
                        }
                    }

                    await Victim.updateOne(
                        { username: username.toLowerCase() },
                        {
                            $inc: { "stats.success": stats.s, "stats.failed": stats.f },
                            $set: { lastSeen: new Date() },
                            $push: {
                                recentMessages: {
                                    $each: recentMsgs,
                                    $slice: -20
                                }
                            }
                        },
                        { upsert: true }
                    );

                    // Update message stats if available
                    if (stats.m) {
                        for (const [msg, counts] of Object.entries(stats.m)) {
                            await this.updateMessageStat(username, msg, counts.s, counts.f);
                        }
                    }

                    // Update proxy stats if available
                    if (stats.p) {
                        const lowerUser = username.toLowerCase();
                        // Find active session
                        const session = await AttackSession.findOne({
                            victimUsername: lowerUser,
                            status: { $in: ['ACTIVE', 'PAUSED'] }
                        }).sort({ startTime: -1 });

                        if (session) {
                            const updates = {};
                            for (const [proxy, count] of Object.entries(stats.p)) {
                                const safeKey = proxy.replace(/\./g, '_');
                                updates[`proxyStats.${safeKey}`] = count;
                            }
                            if (Object.keys(updates).length > 0) {
                                await AttackSession.findByIdAndUpdate(session._id, { $inc: updates });
                            }
                        }
                    }
                }
            }
        }
    }
};
