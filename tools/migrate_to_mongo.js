import { Database } from '../src/db/database.js';
import { connectDB, disconnectDB } from '../src/db/mongo.js';
import { Victim } from '../src/db/models/Victim.js';
import { RequestLog } from '../src/db/models/RequestLog.js';
import { AttackSession } from '../src/db/models/AttackSession.js';
import { QueueItem } from '../src/db/models/QueueItem.js';
import { Preset } from '../src/db/models/Preset.js';
import { User } from '../src/db/models/User.js';
import { LastAttack } from '../src/db/models/LastAttack.js';

// Initialize SQLite connection
const db = Database;

async function migrate() {
    console.log('🚀 Starting Migration to MongoDB...');

    // Connect to Mongo
    await connectDB();

    // Initialize SQLite (creates tables if missing, ensuring structure is known)
    await db.init();

    try {
        await migrateUsers();
        await migrateLastAttacks();
        await migrateVictims();
        await migratePresets();
        await migrateQueue();

        // Attack Sessions and Logs
        await migrateAttackSessions();
        await migrateRequestLogs();

        console.log('✅ Migration Completed Successfully!');
    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        await disconnectDB();
    }
}

async function migrateUsers() {
    console.log('Migrating Users...');
    try {
        const users = await db.getAll('SELECT * FROM users');
        console.log(`Found ${users.length} users.`);

        for (const u of users) {
            // Fetch activity logs for this user
            const logs = await db.getAll('SELECT * FROM activity_logs WHERE user_id = ?', [u.id]);
            const activityLogs = logs.map(l => ({
                action: l.action,
                details: l.details,
                timestamp: l.timestamp
            }));

            await User.updateOne(
                { _id: u.id },
                {
                    _id: u.id,
                    username: u.username,
                    allowed: !!u.allowed,
                    tokens: u.tokens,
                    limits: {
                        maxRps: u.max_rps,
                        maxDuration: u.max_duration
                    },
                    lastSeen: u.last_seen,
                    attacksLaunched: u.attacks_launched,
                    activityLogs: activityLogs
                },
                { upsert: true }
            );
        }
        console.log('Users migrated.');
    } catch (e) {
        console.warn('Users query failed:', e.message);
    }
}

async function migrateLastAttacks() {
    console.log('Migrating Last Attacks...');
    try {
        const rows = await db.getAll('SELECT * FROM last_attacks');
        console.log(`Found ${rows.length} last attack entries.`);

        for (const row of rows) {
            await LastAttack.updateOne(
                { userId: row.user_id },
                {
                    userId: row.user_id,
                    username: row.username,
                    messages: JSON.parse(row.messages || '[]'),
                    rps: row.rps,
                    duration: row.duration,
                    updatedAt: row.updated_at
                },
                { upsert: true }
            );
        }
        console.log('Last attacks migrated.');
    } catch (e) {
        console.warn('Last attacks query failed:', e.message);
    }
}

async function migrateVictims() {
    console.log('Migrating Victims...');
    const victims = await db.getAll('SELECT * FROM victims');
    console.log(`Found ${victims.length} victims.`);

    for (const v of victims) {
        // Fetch related stats
        const msgStats = await db.getAll('SELECT * FROM message_stats WHERE victim_username = ?', [v.username]);
        const recent = await db.getAll('SELECT * FROM recent_messages WHERE victim_username = ?', [v.username]);

        const messageStats = msgStats.map(m => ({
            content: m.content,
            success: m.success_count,
            failed: m.failed_count,
            lastSent: m.last_sent
        }));

        const recentMessages = recent.map(r => ({
            content: r.content,
            success: !!r.success,
            timestamp: r.timestamp
        }));

        await Victim.updateOne(
            { username: v.username },
            {
                username: v.username,
                firstSeen: v.first_seen,
                lastSeen: v.last_seen,
                note: v.note,
                stats: {
                    success: v.success_count,
                    failed: v.failed_count,
                    attackCount: v.attack_count // Assuming this column exists or was added
                },
                messageStats,
                recentMessages
            },
            { upsert: true }
        );
    }
    console.log('Victims migrated.');
}

async function migratePresets() {
    console.log('Migrating Presets...');
    try {
        const presets = await db.getAll('SELECT * FROM presets');
        console.log(`Found ${presets.length} presets.`);

        for (const p of presets) {
            await Preset.updateOne(
                { userId: p.user_id, name: p.name },
                {
                    userId: p.user_id,
                    name: p.name,
                    config: {
                        rps: p.rps,
                        duration: p.duration,
                        template: p.template,
                        messages: JSON.parse(p.messages)
                    },
                    createdAt: p.created_at,
                    updatedAt: p.updated_at
                },
                { upsert: true }
            );
        }
        console.log('Presets migrated.');
    } catch (e) {
        console.warn('Presets table might not exist or empty:', e.message);
    }
}

async function migrateQueue() {
    console.log('Migrating Queue...');
    try {
        const queue = await db.getAll('SELECT * FROM attack_queue');
        console.log(`Found ${queue.length} queue items.`);

        for (const q of queue) {
            let payload = {};
            try {
                payload = JSON.parse(q.payload);
            } catch (e) { }

            await QueueItem.updateOne(
                { _id: q.id },
                {
                    _id: q.id,
                    type: q.type,
                    username: q.username,
                    payload: payload,
                    priority: q.priority,
                    status: q.status,
                    userId: q.user_id,
                    userTag: q.user_tag,
                    addedAt: q.added_at
                },
                { upsert: true }
            );
        }
        console.log('Queue migrated.');
    } catch (e) {
        console.warn('Queue table might not exist or empty:', e.message);
    }
}

async function migrateAttackSessions() {
    console.log('Migrating Attack Sessions...');
    try {
        // Check if table exists
        const check = await db.getOne("SELECT name FROM sqlite_master WHERE type='table' AND name='attack_sessions'");
        if (!check) {
            console.log('No attack_sessions table found. Skipping.');
            return;
        }

        const sessions = await db.getAll('SELECT * FROM attack_sessions');
        console.log(`Found ${sessions.length} sessions.`);

        // Batch insert for speed
        const batches = [];
        const BATCH_SIZE = 100;

        for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
            const chunk = sessions.slice(i, i + BATCH_SIZE);
            const ops = chunk.map(s => ({
                updateOne: {
                    filter: { _id: s.id },
                    update: {
                        _id: s.id,
                        victimUsername: s.victim_username,
                        startTime: s.start_time,
                        endTime: s.end_time,
                        status: s.status,
                        params: JSON.parse(s.params || '{}'),
                        stats: {
                            totalSent: s.total_sent || 0,
                            success: s.success_count || 0,
                            failed: s.fail_count || 0
                        }
                    },
                    upsert: true
                }
            }));
            await AttackSession.bulkWrite(ops);
        }

        console.log('Attack Sessions migrated.');
    } catch (e) {
        console.warn('Failed to migrate sessions:', e.message);
    }
}

async function migrateRequestLogs() {
    console.log('Migrating Request Logs (this may take a while)...');
    try {
        const check = await db.getOne("SELECT name FROM sqlite_master WHERE type='table' AND name='request_logs'");
        if (!check) {
            console.log('No request_logs table found. Skipping.');
            return;
        }

        const count = (await db.getOne('SELECT COUNT(*) as c FROM request_logs')).c;
        console.log(`Found ${count} request logs.`);

        const BATCH_SIZE = 1000; // Larger batch for logs
        let offset = 0;

        while (offset < count) {
            const logs = await db.getAll(`SELECT * FROM request_logs LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
            if (logs.length === 0) break;

            const ops = logs.map(l => ({
                insertOne: {
                    document: {
                        sessionId: l.session_id,
                        timestamp: l.timestamp,
                        target: l.target,
                        proxy: l.proxy,
                        statusCode: l.status_code,
                        responseTime: l.response_time_ms,
                        outcome: l.outcome,
                        errorDetails: JSON.parse(l.error_details || '{}')
                    }
                }
            }));

            await RequestLog.bulkWrite(ops, { ordered: false });

            offset += logs.length;
            process.stdout.write(`\rMigrated ${offset}/${count} logs...`);
        }
        console.log('\nRequest Logs migrated.');

    } catch (e) {
        console.warn('Failed to migrate request logs:', e.message);
    }
}

migrate();
