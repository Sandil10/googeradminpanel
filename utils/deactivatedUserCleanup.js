const pool = require('../config/database');

async function runDeactivatedUserCleanup(poolOrClient = pool, logger = console) {
    const result = await poolOrClient.query(
        "DELETE FROM users WHERE marked_for_deletion_at < NOW() - INTERVAL '7 days'"
    );

    if (result.rowCount > 0) {
        logger.log(`[deactivatedUserCleanup] deleted ${result.rowCount} user(s) past the 7-day window`);
    }

    return result.rowCount;
}

module.exports = {
    runDeactivatedUserCleanup,
};
