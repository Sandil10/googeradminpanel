const pool = require('../config/database');
const {
    ensureSchema,
    getActiveRewardSettings,
    replaceActiveRewardSettings,
    roundToTwo,
} = require('./adCoinRewardSettings');

const normalizeAdType = (value) => {
    const cleaned = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return cleaned || 'ad';
};

const getAdRecord = async (client, adId) => {
    const result = await client.query(
        `SELECT id, ad_id, user_id, campaign_type, status, remaining_budget, budget
         FROM ads
         WHERE ad_id = $1
         LIMIT 1
         FOR UPDATE`,
        [adId]
    );

    return result.rows[0] || null;
};

exports.collectCoin = async (req, res) => {
    const client = await pool.connect();
    try {
        const { adId } = req.params;
        const userId = Number(req.user?.id || 0);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        if (!adId) {
            return res.status(400).json({ success: false, message: 'Ad ID is required' });
        }

        await ensureSchema();
        await client.query('BEGIN');

        const ad = await getAdRecord(client, adId);
        if (!ad) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Ad not found' });
        }

        if (String(ad.status || '').toLowerCase() !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Ad is not active' });
        }

        const settings = await getActiveRewardSettings(client);
        const rewardAmount = roundToTwo(settings.userRewardAmount);
        const commissionAmount = roundToTwo(settings.googerCommissionAmount);
        const advertiserChargeAmount = roundToTwo(settings.advertiserChargeAmount);

        const rewardKey = normalizeAdType(ad.campaign_type || 'ad');
        const collectionInsert = await client.query(
            `INSERT INTO ad_coin_collections (ad_id, ad_type, user_id, reward_amount, commission, advertiser_charge)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (ad_id, ad_type, user_id) DO NOTHING
             RETURNING id`,
            [adId, rewardKey, userId, rewardAmount, commissionAmount, advertiserChargeAmount]
        );

        if (collectionInsert.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'You already collected this coin' });
        }

        const advertiserId = Number(ad.user_id || 0);
        if (!advertiserId) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Ad owner not found' });
        }

        const advertiserResult = await client.query(
            'SELECT id, wallet_balance FROM users WHERE id = $1 LIMIT 1 FOR UPDATE',
            [advertiserId]
        );

        const advertiser = advertiserResult.rows[0];
        if (!advertiser) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Ad owner not found' });
        }

        const advertiserBalance = Number.parseFloat(advertiser.wallet_balance || 0);
        if (advertiserBalance < advertiserChargeAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Reward unavailable' });
        }

        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
            [advertiserChargeAmount, advertiserId]
        );

        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
            [rewardAmount, userId]
        );

        const rewardNote = `Ad coin reward for ${adId}`;
        const transferResult = await client.query(
            `INSERT INTO wallet_transfers (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage)
             VALUES ($1, $2, $3, $4, 'ad_coin_collect', 'accepted', $5, 0)
             RETURNING *`,
            [advertiserId, userId, rewardAmount, rewardNote, commissionAmount]
        );

        await client.query('COMMIT');
        res.status(200).json({
            success: true,
            message: 'Coin collected successfully',
            amount: rewardAmount,
            commission: commissionAmount,
            advertiserCharge: advertiserChargeAmount,
            transfer: transferResult.rows[0],
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {}
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'You already collected this coin' });
        }
        console.error('Collect coin error:', error);
        res.status(500).json({ success: false, message: 'Failed to collect coin' });
    } finally {
        client.release();
    }
};

exports.likeCoin = exports.collectCoin;

const requireAdminUser = async (req) => {
    const result = await pool.query(
        `SELECT id, user_type
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [req.user?.id || 0]
    );

    const user = result.rows[0];
    const userType = String(user?.user_type || '').toLowerCase();
    return Boolean(user && (userType === 'admin' || userType === 'super_admin'));
};

exports.getRewardSettings = async (req, res) => {
    try {
        const settings = await getActiveRewardSettings(pool);
        res.status(200).json({ success: true, settings });
    } catch (error) {
        console.error('Get ad coin reward settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to load ad coin reward settings' });
    }
};

exports.updateRewardSettings = async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureSchema();
        const nextSettings = await replaceActiveRewardSettings(client, req.body || {});
        res.status(200).json({
            success: true,
            settings: nextSettings,
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {}

        if (error.statusCode === 409) {
            return res.status(409).json({
                success: false,
                message: error.message,
                expectedAdvertiserCharge: error.expectedAdvertiserCharge,
            });
        }

        if (error.statusCode === 400) {
            return res.status(400).json({ success: false, message: error.message });
        }

        console.error('Update ad coin reward settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to update ad coin reward settings' });
    } finally {
        client.release();
    }
};

exports.getDefaultRewardSettings = () => ({ ...DEFAULT_REWARD_SETTINGS });
