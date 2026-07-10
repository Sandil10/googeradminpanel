#!/usr/bin/env node

/**
 * Load Test: Measure actual concurrent user capacity
 * Creates fake bot users and measures server response times
 */

const http = require('http');
const https = require('https');
const os = require('os');

const config = {
    baseUrl: process.env.BASE_URL || 'http://localhost:6001',
    botsToCreate: parseInt(process.env.BOTS || '100'),
    testDurationMs: parseInt(process.env.DURATION || '30000'),
    requestIntervalMs: parseInt(process.env.INTERVAL || '5000'),
};

class LoadTester {
    constructor() {
        this.activeBots = new Map();
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errors: new Map(),
            startTime: Date.now(),
        };
        this.isRunning = false;
    }

    async createBotUser(botId) {
        return new Promise((resolve, reject) => {
            const payload = JSON.stringify({
                username: `bot_${botId}_${Date.now()}`,
                full_name: `Bot User ${botId}`,
                email: `bot${botId}@load-test.local`,
                password: 'test123456',
            });

            const options = {
                hostname: new URL(config.baseUrl).hostname,
                port: new URL(config.baseUrl).port || (config.baseUrl.startsWith('https') ? 443 : 80),
                path: '/googer-api/auth/register',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': payload.length,
                },
            };

            const protocol = config.baseUrl.startsWith('https') ? https : http;
            const req = protocol.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({ success: true, userId: json.id, token: json.token });
                    } catch {
                        resolve({ success: false, error: 'parse_error' });
                    }
                });
            });

            req.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });

            req.setTimeout(10000, () => {
                req.destroy();
                resolve({ success: false, error: 'timeout' });
            });

            req.write(payload);
            req.end();
        });
    }

    async botHeartbeat(botId, token) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const payload = JSON.stringify({ user_id: botId, timestamp: new Date().toISOString() });

            const options = {
                hostname: new URL(config.baseUrl).hostname,
                port: new URL(config.baseUrl).port || (config.baseUrl.startsWith('https') ? 443 : 80),
                path: '/api/chat/presence/heartbeat',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Content-Length': payload.length,
                },
            };

            const protocol = config.baseUrl.startsWith('https') ? https : http;
            const req = protocol.request(options, (res) => {
                const responseTime = Date.now() - startTime;
                this.metrics.responseTimes.push(responseTime);
                this.metrics.totalRequests++;

                if (res.statusCode < 400) {
                    this.metrics.successfulRequests++;
                } else {
                    this.metrics.failedRequests++;
                    const key = `${res.statusCode}`;
                    this.metrics.errors.set(key, (this.metrics.errors.get(key) || 0) + 1);
                }

                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => resolve({ success: res.statusCode < 400, responseTime }));
            });

            req.on('error', (err) => {
                this.metrics.failedRequests++;
                this.metrics.errors.set('network', (this.metrics.errors.get('network') || 0) + 1);
                resolve({ success: false, error: err.message });
            });

            req.setTimeout(5000, () => {
                req.destroy();
                this.metrics.failedRequests++;
                this.metrics.errors.set('timeout', (this.metrics.errors.get('timeout') || 0) + 1);
                resolve({ success: false, error: 'timeout' });
            });

            req.write(payload);
            req.end();
        });
    }

    async spawnBot(botId) {
        console.log(`[BOT ${botId}] Creating user...`);
        const userResult = await this.createBotUser(botId);

        if (!userResult.success) {
            console.log(`[BOT ${botId}] Failed to create: ${userResult.error}`);
            return;
        }

        console.log(`[BOT ${botId}] Created successfully, starting heartbeat...`);
        const bot = {
            id: botId,
            userId: userResult.userId,
            token: userResult.token,
            active: true,
        };

        this.activeBots.set(botId, bot);

        const heartbeatInterval = setInterval(async () => {
            if (!this.isRunning || !bot.active) {
                clearInterval(heartbeatInterval);
                return;
            }

            await this.botHeartbeat(bot.userId, bot.token);
        }, config.requestIntervalMs);
    }

    async start() {
        console.log(`\n🤖 Starting Load Test`);
        console.log(`📊 Config:`, config);
        console.log(`🖥️  Server Memory: ${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB`);
        console.log(`✅ Free Memory: ${(os.freemem() / (1024 ** 3)).toFixed(2)} GB\n`);

        this.isRunning = true;
        this.metrics.startTime = Date.now();

        // Spawn bots
        for (let i = 0; i < config.botsToCreate; i++) {
            await this.spawnBot(i);
            await new Promise((resolve) => setTimeout(resolve, 100)); // Stagger creation
        }

        // Run test for duration
        await new Promise((resolve) => setTimeout(resolve, config.testDurationMs));

        this.isRunning = false;
        this.printResults();
    }

    printResults() {
        const testDuration = (Date.now() - this.metrics.startTime) / 1000;
        const avgResponseTime = this.metrics.responseTimes.length > 0
            ? (this.metrics.responseTimes.reduce((a, b) => a + b) / this.metrics.responseTimes.length).toFixed(2)
            : 0;
        const maxResponseTime = this.metrics.responseTimes.length > 0
            ? Math.max(...this.metrics.responseTimes)
            : 0;
        const minResponseTime = this.metrics.responseTimes.length > 0
            ? Math.min(...this.metrics.responseTimes)
            : 0;
        const successRate = this.metrics.totalRequests > 0
            ? ((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(2)
            : 0;

        console.log(`\n📈 LOAD TEST RESULTS`);
        console.log(`════════════════════════════════════════`);
        console.log(`⏱️  Test Duration: ${testDuration.toFixed(2)}s`);
        console.log(`🤖 Active Bots: ${this.activeBots.size}`);
        console.log(`📊 Total Requests: ${this.metrics.totalRequests}`);
        console.log(`✅ Successful: ${this.metrics.successfulRequests}`);
        console.log(`❌ Failed: ${this.metrics.failedRequests}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log(`\n⏳ Response Times:`);
        console.log(`   Min: ${minResponseTime}ms`);
        console.log(`   Avg: ${avgResponseTime}ms`);
        console.log(`   Max: ${maxResponseTime}ms`);

        if (this.metrics.errors.size > 0) {
            console.log(`\n⚠️  Errors:`);
            this.metrics.errors.forEach((count, error) => {
                console.log(`   ${error}: ${count}`);
            });
        }

        console.log(`\n💡 Capacity Estimate:`);
        const estimatedCapacity = Math.round(
            (this.activeBots.size / this.metrics.failedRequests) * 1000
        ) || this.activeBots.size;
        console.log(`   This server can handle ~${estimatedCapacity} concurrent users`);
        console.log(`════════════════════════════════════════\n`);
    }
}

const tester = new LoadTester();
tester.start().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
