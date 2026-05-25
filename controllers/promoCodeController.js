const pool = require('../config/database');

const VALID_AD_TYPES = ['photo_video_ad', 'product_promote_ad', 'profile_promote_ad'];

const ensurePromoCodesTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS promo_codes (
            id SERIAL PRIMARY KEY,
            code VARCHAR(50) UNIQUE NOT NULL,
            ad_type VARCHAR(50) NOT NULL,
            discount_type VARCHAR(20) NOT NULL,
            discount_value DECIMAL(10,2) NOT NULL,
            reach_cap INTEGER DEFAULT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            max_uses INTEGER DEFAULT NULL,
            uses_count INTEGER DEFAULT 0,
            expires_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS reach_cap INTEGER DEFAULT NULL`);
    await pool.query(`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_reach_bonus INTEGER DEFAULT NULL`);
    await pool.query(`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS max_reach_bonus INTEGER DEFAULT NULL`);
    await pool.query(`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS promo_max_days INTEGER DEFAULT NULL`);
    await pool.query(`
        ALTER TABLE ads
            ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50),
            ADD COLUMN IF NOT EXISTS promo_discount DECIMAL(10,2),
            ADD COLUMN IF NOT EXISTS reach_cap INTEGER DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS promo_reach_min INTEGER DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS promo_reach_max INTEGER DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS promo_max_days INTEGER DEFAULT NULL
    `);
    // Fix any existing rows that were saved with old 'rupee' discount_type
    await pool.query(`
        UPDATE promo_codes
        SET discount_type = 'reach'
        WHERE ad_type IN ('photo_video_ad', 'product_promote_ad')
          AND discount_type = 'rupee'
    `);
};

// Compute reach (min/max) and max_days from the applicable reach tier for a given budget + ad_type.
// Returns empty object for profile_promote_ad or when no tier matches.
const computeReachAndDays = async (ad_type, budget) => {
    if (ad_type === 'profile_promote_ad' || !budget || budget <= 0) return {};
    const { rows } = await pool.query(
        `SELECT * FROM reach_tiers
         WHERE ad_type = $1 AND budget_from <= $2 AND (budget_to IS NULL OR budget_to >= $2)
         ORDER BY budget_from DESC LIMIT 1`,
        [ad_type, budget]
    );
    if (rows.length === 0) return {};
    const tier = rows[0];
    return {
        min_reach_bonus: Math.round(budget * Number(tier.min_multiplier)),
        max_reach_bonus: Math.round(budget * Number(tier.max_multiplier)),
        promo_max_days: Number(tier.max_days),
    };
};

const discountTypeForAdType = (ad_type) =>
    ad_type === 'profile_promote_ad' ? 'days' : 'reach';

const getAll = async (req, res) => {
    try {
        await ensurePromoCodesTable();
        const result = await pool.query(
            'SELECT * FROM promo_codes ORDER BY ad_type ASC, created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

const create = async (req, res) => {
    try {
        await ensurePromoCodesTable();
        const { code, ad_type, discount_value, max_uses, expires_at } = req.body;

        if (!code || !ad_type || discount_value === undefined || discount_value === null) {
            return res.status(400).json({ message: 'code, ad_type, and discount_value are required' });
        }

        if (!VALID_AD_TYPES.includes(ad_type)) {
            return res.status(400).json({ message: `ad_type must be one of: ${VALID_AD_TYPES.join(', ')}` });
        }

        const numericValue = Number(discount_value);
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
            return res.status(400).json({ message: 'discount_value must be a positive number' });
        }

        const discount_type = discountTypeForAdType(ad_type);
        const { reach_cap } = req.body;
        const reachCapVal = (reach_cap !== undefined && reach_cap !== null && reach_cap !== '')
            ? Number(reach_cap) : null;

        const { min_reach_bonus: minReachVal, max_reach_bonus: maxReachVal, promo_max_days: promoMaxDays } =
            await computeReachAndDays(ad_type, numericValue);

        const result = await pool.query(
            `INSERT INTO promo_codes (code, ad_type, discount_type, discount_value, reach_cap, min_reach_bonus, max_reach_bonus, promo_max_days, max_uses, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                String(code).toUpperCase().trim(),
                ad_type,
                discount_type,
                numericValue,
                reachCapVal,
                minReachVal ?? null,
                maxReachVal ?? null,
                promoMaxDays ?? null,
                max_uses || null,
                expires_at || null,
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'A promo code with this name already exists' });
        }
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

const update = async (req, res) => {
    try {
        await ensurePromoCodesTable();
        const { id } = req.params;
        const { code, discount_value, is_active, max_uses, expires_at } = req.body;

        const existing = await pool.query('SELECT * FROM promo_codes WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ message: 'Promo code not found' });
        }

        const current = existing.rows[0];

        const nextCode = code !== undefined ? String(code).toUpperCase().trim() : current.code;
        const nextValue = discount_value !== undefined ? Number(discount_value) : Number(current.discount_value);
        const nextActive = is_active !== undefined ? Boolean(is_active) : current.is_active;
        const nextMaxUses = max_uses !== undefined ? (max_uses === null ? null : Number(max_uses)) : current.max_uses;
        const nextExpiresAt = expires_at !== undefined ? (expires_at || null) : current.expires_at;
        const { reach_cap } = req.body;
        const nextReachCap = reach_cap !== undefined
            ? ((reach_cap === null || reach_cap === '') ? null : Number(reach_cap))
            : current.reach_cap;

        if (!Number.isFinite(nextValue) || nextValue <= 0) {
            return res.status(400).json({ message: 'discount_value must be a positive number' });
        }

        // Always re-derive discount_type from ad_type so old 'rupee' rows get corrected on save
        const nextDiscountType = discountTypeForAdType(current.ad_type);

        // Recompute reach and max_days from the current budget value
        const { min_reach_bonus: nextMinReach, max_reach_bonus: nextMaxReach, promo_max_days: nextMaxDays } =
            await computeReachAndDays(current.ad_type, nextValue);

        const result = await pool.query(
            `UPDATE promo_codes
             SET code = $1,
                 discount_type = $2,
                 discount_value = $3,
                 is_active = $4,
                 max_uses = $5,
                 expires_at = $6,
                 reach_cap = $7,
                 min_reach_bonus = $8,
                 max_reach_bonus = $9,
                 promo_max_days = $10,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $11
             RETURNING *`,
            [nextCode, nextDiscountType, nextValue, nextActive, nextMaxUses, nextExpiresAt, nextReachCap,
             nextMinReach ?? null, nextMaxReach ?? null, nextMaxDays ?? null, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'A promo code with this name already exists' });
        }
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

const remove = async (req, res) => {
    try {
        await ensurePromoCodesTable();
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM promo_codes WHERE id = $1 RETURNING *',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Promo code not found' });
        }
        res.json({ message: 'Promo code deleted', deleted: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// Public-facing: validate a promo code for a given ad_type
const validate = async (req, res) => {
    try {
        await ensurePromoCodesTable();
        const { code, ad_type } = req.body;

        if (!code || !ad_type) {
            return res.status(400).json({ message: 'code and ad_type are required' });
        }

        const result = await pool.query(
            `SELECT * FROM promo_codes
             WHERE code = $1 AND is_active = TRUE`,
            [String(code).toUpperCase().trim()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Invalid or inactive promo code' });
        }

        const promo = result.rows[0];

        if (promo.ad_type !== ad_type) {
            return res.status(400).json({ message: 'Promo code is not valid for this ad type' });
        }

        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
            return res.status(400).json({ message: 'Promo code has expired' });
        }

        if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
            return res.status(400).json({ message: 'Promo code usage limit reached' });
        }

        res.json({
            valid: true,
            code: promo.code,
            ad_type: promo.ad_type,
            discount_type: promo.discount_type,
            discount_value: Number(promo.discount_value),
            min_reach_bonus: promo.min_reach_bonus !== null ? Number(promo.min_reach_bonus) : null,
            max_reach_bonus: promo.max_reach_bonus !== null ? Number(promo.max_reach_bonus) : null,
            reach_cap: promo.reach_cap !== null ? Number(promo.reach_cap) : null,
            promo_max_days: promo.promo_max_days !== null ? Number(promo.promo_max_days) : null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// Called when an ad is submitted with a promo code to record redemption
const redeem = async (req, res) => {
    const client = await pool.connect();
    try {
        await ensurePromoCodesTable();
        const { code, ad_type, ad_id } = req.body;

        if (!code || !ad_type) {
            return res.status(400).json({ message: 'code and ad_type are required' });
        }

        await client.query('BEGIN');

        const result = await client.query(
            `SELECT * FROM promo_codes
             WHERE code = $1 AND is_active = TRUE
             FOR UPDATE`,
            [String(code).toUpperCase().trim()]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Invalid or inactive promo code' });
        }

        const promo = result.rows[0];

        if (promo.ad_type !== ad_type) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Promo code is not valid for this ad type' });
        }

        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Promo code has expired' });
        }

        if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Promo code usage limit reached' });
        }

        // Increment usage count
        await client.query(
            `UPDATE promo_codes SET uses_count = uses_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [promo.id]
        );

        // Record on the ad if ad_id provided
        if (ad_id) {
            await client.query(
                `UPDATE ads SET promo_code = $1, promo_discount = $2 WHERE ad_id = $3`,
                [promo.code, promo.discount_value, ad_id]
            );
        }

        await client.query('COMMIT');

        res.json({
            redeemed: true,
            code: promo.code,
            ad_type: promo.ad_type,
            discount_type: promo.discount_type,
            discount_value: Number(promo.discount_value),
            min_reach_bonus: promo.min_reach_bonus !== null ? Number(promo.min_reach_bonus) : null,
            max_reach_bonus: promo.max_reach_bonus !== null ? Number(promo.max_reach_bonus) : null,
            reach_cap: promo.reach_cap !== null ? Number(promo.reach_cap) : null,
            promo_max_days: promo.promo_max_days !== null ? Number(promo.promo_max_days) : null,
        });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
};

module.exports = { getAll, create, update, remove, validate, redeem, ensurePromoCodesTable };
