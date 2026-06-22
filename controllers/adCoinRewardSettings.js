const pool = require('../config/database');

const DEFAULT_REWARD_SETTINGS = {
    user_reward_amount: 1.00,
    googer_commission_amount: 0.25,
    advertiser_charge_amount: 1.25,
    required_watch_seconds: 15,
    resell_googer_commission_percentage: 10.00,
};

let schemaReady = null;

const roundToTwo = (value) => Math.round(Number(value || 0) * 100) / 100;

const parseAmount = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? roundToTwo(numeric) : 0;
};

const formatSettings = (row) => ({
    id: row.id,
    userRewardAmount: Number(row.user_reward_amount || 0),
    googerCommissionAmount: Number(row.googer_commission_amount || 0),
    advertiserChargeAmount: Number(row.advertiser_charge_amount || 0),
    requiredWatchSeconds: Number(row.required_watch_seconds || 0),
    resellGoogerCommissionPercentage: Number(row.resell_googer_commission_percentage ?? 10),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const ensureSchema = async () => {
    if (!schemaReady) {
        schemaReady = (async () => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                await client.query(`
                    CREATE TABLE IF NOT EXISTS ad_coin_reward_settings (
                        id SERIAL PRIMARY KEY,
                        user_reward_amount DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
                        googer_commission_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.25,
                        advertiser_charge_amount DECIMAL(10, 2) NOT NULL DEFAULT 1.25,
                        required_watch_seconds INTEGER NOT NULL DEFAULT 15,
                        resell_googer_commission_percentage DECIMAL(8, 2) NOT NULL DEFAULT 10.00,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                await client.query(`ALTER TABLE ad_coin_reward_settings ADD COLUMN IF NOT EXISTS required_watch_seconds INTEGER NOT NULL DEFAULT 15`);
                await client.query(`ALTER TABLE ad_coin_reward_settings ADD COLUMN IF NOT EXISTS resell_googer_commission_percentage DECIMAL(8, 2) NOT NULL DEFAULT 10.00`);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS ad_coin_collections (
                        id SERIAL PRIMARY KEY,
                        ad_id VARCHAR(120) NOT NULL,
                        ad_type VARCHAR(80) NOT NULL,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        reward_amount DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
                        commission DECIMAL(10, 2) NOT NULL DEFAULT 0.25,
                        advertiser_charge DECIMAL(10, 2) NOT NULL DEFAULT 1.25,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                await client.query(`ALTER TABLE ad_coin_collections ADD COLUMN IF NOT EXISTS reward_amount DECIMAL(10, 2) NOT NULL DEFAULT 1.00`);
                await client.query(`ALTER TABLE ad_coin_collections ADD COLUMN IF NOT EXISTS commission DECIMAL(10, 2) NOT NULL DEFAULT 0.25`);
                await client.query(`ALTER TABLE ad_coin_collections ADD COLUMN IF NOT EXISTS advertiser_charge DECIMAL(10, 2) NOT NULL DEFAULT 1.25`);
                await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_coin_collections_unique ON ad_coin_collections (ad_id, ad_type, user_id)`);

                const settingsCount = await client.query('SELECT COUNT(*)::int AS count FROM ad_coin_reward_settings');
                if (Number(settingsCount.rows[0]?.count || 0) === 0) {
                    await client.query(
                        `INSERT INTO ad_coin_reward_settings (
                            user_reward_amount,
                            googer_commission_amount,
                            advertiser_charge_amount,
                            required_watch_seconds,
                            resell_googer_commission_percentage,
                            is_active
                        ) VALUES ($1, $2, $3, $4, $5, true)`,
                        [
                            DEFAULT_REWARD_SETTINGS.user_reward_amount,
                            DEFAULT_REWARD_SETTINGS.googer_commission_amount,
                            DEFAULT_REWARD_SETTINGS.advertiser_charge_amount,
                            DEFAULT_REWARD_SETTINGS.required_watch_seconds,
                            DEFAULT_REWARD_SETTINGS.resell_googer_commission_percentage,
                        ]
                    );
                }

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                schemaReady = null;
                throw error;
            } finally {
                client.release();
            }
        })();
    }

    return schemaReady;
};

const getActiveRewardSettings = async (client = pool) => {
    await ensureSchema();

    const activeResult = await client.query(
        `SELECT id, user_reward_amount, googer_commission_amount, advertiser_charge_amount, required_watch_seconds, resell_googer_commission_percentage, is_active, created_at, updated_at
         FROM ad_coin_reward_settings
         WHERE is_active = true
         ORDER BY updated_at DESC, id DESC
         LIMIT 1`
    );

    if (activeResult.rows.length > 0) {
        return formatSettings(activeResult.rows[0]);
    }

    const insertResult = await client.query(
        `INSERT INTO ad_coin_reward_settings (
            user_reward_amount,
            googer_commission_amount,
            advertiser_charge_amount,
            required_watch_seconds,
            resell_googer_commission_percentage,
            is_active
        ) VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id, user_reward_amount, googer_commission_amount, advertiser_charge_amount, required_watch_seconds, resell_googer_commission_percentage, is_active, created_at, updated_at`,
        [
            DEFAULT_REWARD_SETTINGS.user_reward_amount,
            DEFAULT_REWARD_SETTINGS.googer_commission_amount,
            DEFAULT_REWARD_SETTINGS.advertiser_charge_amount,
            DEFAULT_REWARD_SETTINGS.required_watch_seconds,
            DEFAULT_REWARD_SETTINGS.resell_googer_commission_percentage,
        ]
    );

    return formatSettings(insertResult.rows[0]);
};

const validateRewardSettings = (payload) => {
    const userRewardAmount = parseAmount(payload?.userRewardAmount);
    const googerCommissionAmount = parseAmount(payload?.googerCommissionAmount);
    const advertiserChargeAmount = parseAmount(payload?.advertiserChargeAmount);
    const requiredWatchSeconds = Number.parseInt(payload?.requiredWatchSeconds, 10);
    const resellGoogerCommissionPercentage = parseAmount(payload?.resellGoogerCommissionPercentage ?? 10);
    const allowMismatch = payload?.allowMismatch === true || payload?.allowMismatch === 'true';

    if (userRewardAmount < 0 || googerCommissionAmount < 0 || advertiserChargeAmount < 0) {
        const error = new Error('Reward values cannot be negative');
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isInteger(requiredWatchSeconds) || requiredWatchSeconds < 0) {
        const error = new Error('Required watch seconds must be a whole number greater than or equal to 0');
        error.statusCode = 400;
        throw error;
    }

    if (resellGoogerCommissionPercentage < 0 || resellGoogerCommissionPercentage > 100) {
        const error = new Error('Resell Googer commission percentage must be between 0 and 100');
        error.statusCode = 400;
        throw error;
    }

    const expectedCharge = roundToTwo(userRewardAmount + googerCommissionAmount);
    const chargeMismatch = roundToTwo(advertiserChargeAmount) !== expectedCharge;

    if (chargeMismatch && !allowMismatch) {
        const error = new Error(`Advertiser charge should equal ${expectedCharge.toFixed(2)} unless you confirm the override.`);
        error.statusCode = 409;
        error.expectedAdvertiserCharge = expectedCharge;
        throw error;
    }

    return {
        userRewardAmount,
        googerCommissionAmount,
        advertiserChargeAmount,
        requiredWatchSeconds,
        resellGoogerCommissionPercentage,
        allowMismatch,
    };
};

const replaceActiveRewardSettings = async (client, payload) => {
    const { userRewardAmount, googerCommissionAmount, advertiserChargeAmount, requiredWatchSeconds, resellGoogerCommissionPercentage } = validateRewardSettings(payload);

    await client.query('BEGIN');
    await client.query('UPDATE ad_coin_reward_settings SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE is_active = true');

    const insertResult = await client.query(
        `INSERT INTO ad_coin_reward_settings (
            user_reward_amount,
            googer_commission_amount,
            advertiser_charge_amount,
            required_watch_seconds,
            resell_googer_commission_percentage,
            is_active,
            created_at,
            updated_at
        ) VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, user_reward_amount, googer_commission_amount, advertiser_charge_amount, required_watch_seconds, resell_googer_commission_percentage, is_active, created_at, updated_at`,
        [userRewardAmount, googerCommissionAmount, advertiserChargeAmount, requiredWatchSeconds, resellGoogerCommissionPercentage]
    );

    await client.query('COMMIT');
    return formatSettings(insertResult.rows[0]);
};

module.exports = {
    DEFAULT_REWARD_SETTINGS,
    ensureSchema,
    getActiveRewardSettings,
    replaceActiveRewardSettings,
    validateRewardSettings,
    parseAmount,
    roundToTwo,
    formatSettings,
};
