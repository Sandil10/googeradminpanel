const pool = require('../config/database');

const AD_TYPES = ['photo_video_ad', 'product_promote_ad', 'profile_promote_ad'];

const ensureTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reach_tiers (
            id                    SERIAL PRIMARY KEY,
            ad_type               VARCHAR(50)   NOT NULL,
            budget_from           DECIMAL(12,2) NOT NULL,
            budget_to             DECIMAL(12,2) NOT NULL,
            min_days              INTEGER       NOT NULL DEFAULT 1,
            max_days              INTEGER       NOT NULL DEFAULT 1,
            min_multiplier        DECIMAL(10,4) NOT NULL DEFAULT 0,
            max_multiplier        DECIMAL(10,4) NOT NULL DEFAULT 0,
            max_reach_multiplier  DECIMAL(10,4) DEFAULT NULL,
            created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
            updated_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Add columns if table existed without them
    await pool.query(`ALTER TABLE reach_tiers ADD COLUMN IF NOT EXISTS ad_type VARCHAR(50) NOT NULL DEFAULT 'photo_video_ad'`);
    await pool.query(`ALTER TABLE reach_tiers ADD COLUMN IF NOT EXISTS max_reach_multiplier DECIMAL(10,4) DEFAULT NULL`);
    // drop old fixed-number cap column if it exists from earlier version
    await pool.query(`ALTER TABLE reach_tiers DROP COLUMN IF EXISTS max_reach_cap`);

    // Seed defaults per ad type only when empty
    const { rows } = await pool.query('SELECT COUNT(*) FROM reach_tiers');
    if (Number(rows[0].count) === 0) {
        for (const ad_type of AD_TYPES) {
            await pool.query(`
                INSERT INTO reach_tiers (ad_type, budget_from, budget_to, min_days, max_days, min_multiplier, max_multiplier) VALUES
                ($1, 1,    500,   1, 1,  3, 5),
                ($1, 501,  2000,  1, 7,  4, 8),
                ($1, 2001, 50000, 3, 30, 5, 12)
            `, [ad_type]);
        }
    }
};

const DURATION_ONLY_TYPES = ['profile_promote_ad'];

const campaignTypeSqlForAdType = (adType) => {
    if (adType === 'product_promote_ad') {
        return `LOWER(TRIM(COALESCE(campaign_type, ''))) IN ('product promote', 'product_promote')`;
    }
    if (adType === 'profile_promote_ad') {
        return `LOWER(TRIM(COALESCE(campaign_type, ''))) IN ('profile promote', 'profile_promote')`;
    }
    return `LOWER(TRIM(COALESCE(campaign_type, ''))) IN (
        'photo and video',
        'photo & video',
        'photo promote',
        'video promote',
        'photo_video_ad',
        'photo video'
    )`;
};

const ensureAdCapColumns = async () => {
    await pool.query(`
        ALTER TABLE ads
            ADD COLUMN IF NOT EXISTS max_reach_cap INTEGER DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP DEFAULT NULL
    `);
};

const syncAdCapsForTier = async (tier) => {
    await ensureAdCapColumns();
    const adTypeCondition = campaignTypeSqlForAdType(tier.ad_type);
    const budgetFrom = Number(tier.budget_from);
    const budgetTo = Number(tier.budget_to);

    if (tier.max_reach_multiplier === null || tier.max_reach_multiplier === undefined) {
        await pool.query(
            `UPDATE ads
             SET max_reach_cap = NULL,
                 current_reach = GREATEST(COALESCE(current_reach, 0), COALESCE(impressions, 0)),
                 updated_at = CURRENT_TIMESTAMP
             WHERE ${adTypeCondition}
               AND COALESCE(budget, 0) >= $1
               AND COALESCE(budget, 0) <= $2`,
            [budgetFrom, budgetTo]
        );
        return 0;
    }

    await pool.query(
        `UPDATE ads a
         SET max_reach_cap = GREATEST(1, ROUND(COALESCE(a.budget, 0)::numeric * $3::numeric))::integer,
             current_reach = GREATEST(COALESCE(a.current_reach, 0), COALESCE(a.impressions, 0)),
             updated_at = CURRENT_TIMESTAMP
         WHERE ${adTypeCondition}
           AND COALESCE(a.budget, 0) >= $1
           AND COALESCE(a.budget, 0) <= $2`,
        [budgetFrom, budgetTo, Number(tier.max_reach_multiplier)]
    );

    const completed = await pool.query(
        `UPDATE ads a
         SET status = 'Completed',
             completed_at = COALESCE(a.completed_at, CURRENT_TIMESTAMP),
             remaining_budget = CASE
                 WHEN LOWER(COALESCE(a.campaign_type, '')) IN ('product promote','photo promote','video promote','photo and video','photo & video','profile promote')
                 THEN 0
                 ELSE a.remaining_budget
             END,
             current_reach = GREATEST(COALESCE(a.current_reach, 0), COALESCE(a.impressions, 0)),
             updated_at = CURRENT_TIMESTAMP
         WHERE ${adTypeCondition}
           AND COALESCE(a.budget, 0) >= $1
           AND COALESCE(a.budget, 0) <= $2
           AND LOWER(TRIM(REPLACE(REPLACE(COALESCE(a.status, ''), '_', ' '), '-', ' '))) IN ('active', 'approved')
           AND COALESCE(a.max_reach_cap, 0) > 0
           AND COALESCE(a.impressions, 0) >= COALESCE(a.max_reach_cap, 0)`,
        [budgetFrom, budgetTo]
    );

    return completed.rowCount || 0;
};

function validate(body) {
    const { ad_type, budget_from, budget_to, min_days, max_days, min_multiplier, max_multiplier } = body;
    if (!AD_TYPES.includes(ad_type)) return `ad_type must be one of: ${AD_TYPES.join(', ')}`;
    const bf  = Number(budget_from);
    const bt  = Number(budget_to);
    const mnd = Number(min_days);
    const mxd = Number(max_days);

    if (!Number.isFinite(bf) || bf < 0)          return 'budget_from must be a non-negative number';
    if (!Number.isFinite(bt) || bt < bf)          return 'budget_to must be greater than or equal to budget_from';
    if (!Number.isInteger(mnd) || mnd < 1)        return 'min_days must be a positive integer';
    if (!Number.isInteger(mxd) || mxd < mnd)      return 'max_days must be >= min_days';

    // Multipliers only required for reach-based ad types
    if (!DURATION_ONLY_TYPES.includes(ad_type)) {
        const mnm = Number(min_multiplier);
        const mxm = Number(max_multiplier);
        if (!Number.isFinite(mnm) || mnm <= 0)    return 'min_multiplier must be a positive number';
        if (!Number.isFinite(mxm) || mxm <= 0)    return 'max_multiplier must be a positive number';
        if (mxm < mnm)                             return 'max_multiplier must be >= min_multiplier';
    }
    return null;
}

// GET /api/admin/customization/reach-tiers?ad_type=photo_video_ad
const getAll = async (req, res) => {
    try {
        await ensureTable();
        const { ad_type } = req.query;
        let query = 'SELECT * FROM reach_tiers';
        const params = [];
        if (ad_type && AD_TYPES.includes(ad_type)) {
            query += ' WHERE ad_type = $1';
            params.push(ad_type);
        }
        query += ' ORDER BY ad_type ASC, budget_from ASC';
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/admin/customization/reach-tiers
const create = async (req, res) => {
    try {
        await ensureTable();
        const err = validate(req.body);
        if (err) return res.status(400).json({ message: err });

        const { ad_type, budget_from, budget_to, min_days, max_days, min_multiplier, max_multiplier } = req.body;
        const isDurationOnly = DURATION_ONLY_TYPES.includes(ad_type);
        const { rows } = await pool.query(
            `INSERT INTO reach_tiers (ad_type, budget_from, budget_to, min_days, max_days, min_multiplier, max_multiplier)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [ad_type, Number(budget_from), Number(budget_to), Number(min_days), Number(max_days),
             isDurationOnly ? 0 : Number(min_multiplier),
             isDurationOnly ? 0 : Number(max_multiplier)]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /api/admin/customization/reach-tiers/:id
const update = async (req, res) => {
    try {
        await ensureTable();
        const err = validate(req.body);
        if (err) return res.status(400).json({ message: err });

        const { ad_type, budget_from, budget_to, min_days, max_days, min_multiplier, max_multiplier } = req.body;
        const isDurationOnly = DURATION_ONLY_TYPES.includes(ad_type);
        const { rows } = await pool.query(
            `UPDATE reach_tiers
             SET ad_type=$1, budget_from=$2, budget_to=$3, min_days=$4, max_days=$5,
                 min_multiplier=$6, max_multiplier=$7, updated_at=CURRENT_TIMESTAMP
             WHERE id=$8 RETURNING *`,
            [ad_type, Number(budget_from), Number(budget_to), Number(min_days), Number(max_days),
             isDurationOnly ? 0 : Number(min_multiplier),
             isDurationOnly ? 0 : Number(max_multiplier),
             req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Tier not found' });
        await syncAdCapsForTier(rows[0]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/admin/customization/reach-tiers/:id
const remove = async (req, res) => {
    try {
        await ensureTable();
        const { rows } = await pool.query(
            'DELETE FROM reach_tiers WHERE id=$1 RETURNING id', [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Tier not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /api/admin/customization/reach-tiers/:id/max-reach-cap
const setMaxReachCap = async (req, res) => {
    try {
        await ensureTable();
        const raw = req.body.max_reach_multiplier;
        // null / empty = remove multiplier
        const multiplier = (raw === null || raw === '' || raw === undefined)
            ? null : Number(raw);
        if (multiplier !== null && (!Number.isFinite(multiplier) || multiplier <= 0)) {
            return res.status(400).json({ message: 'max_reach_multiplier must be a positive number (e.g. 4)' });
        }
        const { rows } = await pool.query(
            `UPDATE reach_tiers SET max_reach_multiplier=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *`,
            [multiplier, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Tier not found' });
        await syncAdCapsForTier(rows[0]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/admin/customization/reach-tiers/public?ad_type=photo_video_ad  (no auth)
const getPublic = async (req, res) => {
    try {
        await ensureTable();
        const { ad_type } = req.query;
        let query = 'SELECT id, ad_type, budget_from, budget_to, min_days, max_days, min_multiplier, max_multiplier, max_reach_multiplier FROM reach_tiers';
        const params = [];
        if (ad_type && AD_TYPES.includes(ad_type)) {
            query += ' WHERE ad_type = $1';
            params.push(ad_type);
        }
        query += ' ORDER BY ad_type ASC, budget_from ASC';
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAll, create, update, remove, setMaxReachCap, getPublic };
