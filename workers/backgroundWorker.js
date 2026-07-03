require('dotenv').config();

const pool = require('../config/database');
const { assertFinanceSchemaReady } = require('../../shared/utils/financeSchemaGuard');
const { runBackgroundWorker } = require('../../shared/utils/backgroundWorkerRunner');
const { runDeactivatedUserCleanup } = require('../utils/deactivatedUserCleanup');

async function main() {
    await assertFinanceSchemaReady(pool);

    const worker = await runBackgroundWorker({
        pool,
        workerId: process.env.WORKER_ID || `googer-admin-${process.pid}`,
        queueName: 'googer-admin',
        serviceName: 'googer-admin',
        pollIntervalMs: Number(process.env.BACKGROUND_WORKER_POLL_MS || 1000),
        defaultRetryDelayMs: Number(process.env.BACKGROUND_WORKER_RETRY_MS || 30000),
        handlers: {
            'admin.cleanup.deactivated_users': async () => {
                await runDeactivatedUserCleanup(pool);
            },
        },
        recurringJobs: [
            {
                jobType: 'admin.cleanup.deactivated_users',
                jobKey: 'admin.cleanup.deactivated_users',
                everyMs: Number(process.env.DEACTIVATED_USER_CLEANUP_MS || 60 * 60 * 1000),
                maxAttempts: 10,
            },
        ],
    });

    const shutdown = async (signal) => {
        console.log(`[background-worker] ${signal} received, stopping...`);
        worker.stop();
        await pool.end().catch(() => {});
        process.exit(0);
    };

    process.on('SIGINT', () => { shutdown('SIGINT'); });
    process.on('SIGTERM', () => { shutdown('SIGTERM'); });
    worker.done.catch((error) => {
        console.error('[background-worker] worker loop failed:', error);
        process.exit(1);
    });
    console.log(`[background-worker] Googer admin worker running as ${process.env.WORKER_ID || `googer-admin-${process.pid}`}`);
}

main().catch((error) => {
    console.error('[background-worker] startup failed:', error);
    process.exit(1);
});
