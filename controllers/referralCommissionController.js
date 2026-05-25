const pool = require('../config/database');

// ── Table bootstrap ───────────────────────────────────────────────────────────

async function ensureTables() {
    // Level settings table (shared with referralController)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS referral_level_settings (
            id                       SERIAL PRIMARY KEY,
            level                    INTEGER UNIQUE NOT NULL,
            name                     VARCHAR(80)    NOT NULL,
            commission_percentage    NUMERIC(8,2)   NOT NULL DEFAULT 0,
            ad_commission_percentage NUMERIC(8,2)   NOT NULL DEFAULT 0,
            is_active                BOOLEAN        NOT NULL DEFAULT true,
            sort_order               INTEGER        NOT NULL DEFAULT 0,
            created_at               TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
            updated_at               TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Commission pool settings table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS referral_commission_settings (
            id                              SERIAL PRIMARY KEY,
            product_purchase_pool_percentage NUMERIC(8,2) NOT NULL DEFAULT 20,
            ad_purchase_pool_percentage      NUMERIC(8,2) NOT NULL DEFAULT 20,
            updated_at                      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Seed a single settings row if absent
    await pool.query(`
        INSERT INTO referral_commission_settings
            (product_purchase_pool_percentage, ad_purchase_pool_percentage)
        SELECT 20, 20
        WHERE NOT EXISTS (SELECT 1 FROM referral_commission_settings)
    `);
}

ensureTables().catch(err =>
    console.error('referralCommissionController init error:', err.message)
);

// ── GET /api/admin/customization/referral-level-settings ─────────────────────

const getLevels = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, level, name, commission_percentage, ad_commission_percentage,
                    is_active, sort_order, updated_at
             FROM referral_level_settings
             ORDER BY sort_order ASC, level ASC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getLevels:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch referral levels' });
    }
};

// ── POST /api/admin/customization/referral-level-settings ────────────────────

const addLevel = async (req, res) => {
    const { level, name, commission_percentage, ad_commission_percentage, is_active, sort_order } = req.body;
    if (level == null || !name) {
        return res.status(400).json({ success: false, message: 'level and name are required' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO referral_level_settings
                 (level, name, commission_percentage, ad_commission_percentage, is_active, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [level, name.trim(), commission_percentage ?? 0, ad_commission_percentage ?? 0, is_active ?? true, sort_order ?? level]
        );
        return res.status(201).json({ success: true, data: rows[0], message: 'Level added' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ success: false, message: `Level ${level} already exists` });
        }
        console.error('addLevel:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to add level' });
    }
};

// ── POST /api/admin/customization/referral-level-settings/bulk ───────────────

const bulkSaveLevels = async (req, res) => {
    const { levels } = req.body;
    if (!Array.isArray(levels) || levels.length === 0) {
        return res.status(400).json({ success: false, message: 'levels array is required' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const saved = [];
        for (const l of levels) {
            const { level, name, commission_percentage, ad_commission_percentage, is_active, sort_order } = l;
            if (level == null || !name) continue;
            const { rows } = await client.query(
                `INSERT INTO referral_level_settings
                     (level, name, commission_percentage, ad_commission_percentage, is_active, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (level) DO UPDATE
                     SET name                     = EXCLUDED.name,
                         commission_percentage    = EXCLUDED.commission_percentage,
                         ad_commission_percentage = EXCLUDED.ad_commission_percentage,
                         is_active                = EXCLUDED.is_active,
                         sort_order               = EXCLUDED.sort_order,
                         updated_at               = CURRENT_TIMESTAMP
                 RETURNING *`,
                [level, name.trim(), commission_percentage ?? 0, ad_commission_percentage ?? 0, is_active ?? true, sort_order ?? level]
            );
            saved.push(rows[0]);
        }
        await client.query('COMMIT');
        return res.json({ success: true, data: saved, message: 'All levels saved' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('bulkSaveLevels:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to save levels' });
    } finally {
        client.release();
    }
};

// ── PUT /api/admin/customization/referral-level-settings/:level ──────────────

const updateLevel = async (req, res) => {
    const levelNum = parseInt(req.params.level, 10);
    const { name, commission_percentage, ad_commission_percentage, is_active, sort_order } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE referral_level_settings
             SET name                     = COALESCE($1, name),
                 commission_percentage    = COALESCE($2, commission_percentage),
                 ad_commission_percentage = COALESCE($3, ad_commission_percentage),
                 is_active                = COALESCE($4, is_active),
                 sort_order               = COALESCE($5, sort_order),
                 updated_at               = CURRENT_TIMESTAMP
             WHERE level = $6
             RETURNING *`,
            [name?.trim() ?? null, commission_percentage ?? null, ad_commission_percentage ?? null, is_active ?? null, sort_order ?? null, levelNum]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Level not found' });
        }
        return res.json({ success: true, data: rows[0], message: 'Level updated' });
    } catch (err) {
        console.error('updateLevel:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to update level' });
    }
};

// ── DELETE /api/admin/customization/referral-level-settings/:level ───────────

const deleteLevel = async (req, res) => {
    const levelNum = parseInt(req.params.level, 10);
    if (levelNum === 0) {
        return res.status(400).json({ success: false, message: 'Cannot delete the Googer level' });
    }
    try {
        const { rows } = await pool.query(
            'DELETE FROM referral_level_settings WHERE level = $1 RETURNING id', [levelNum]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Level not found' });
        }
        return res.json({ success: true, message: 'Level deleted' });
    } catch (err) {
        console.error('deleteLevel:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to delete level' });
    }
};

// ── GET /api/admin/customization/referral-commission-settings ────────────────

const getCommissionSettings = async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM referral_commission_settings ORDER BY id ASC LIMIT 1'
        );
        return res.json({ success: true, data: rows[0] || { product_purchase_pool_percentage: 20, ad_purchase_pool_percentage: 20 } });
    } catch (err) {
        console.error('getCommissionSettings:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch commission settings' });
    }
};

// ── PUT /api/admin/customization/referral-commission-settings ────────────────

const updateCommissionSettings = async (req, res) => {
    const { productPurchasePoolPercentage, adPurchasePoolPercentage } = req.body;
    if (productPurchasePoolPercentage == null && adPurchasePoolPercentage == null) {
        return res.status(400).json({ success: false, message: 'At least one field is required' });
    }
    try {
        const { rows } = await pool.query(
            `UPDATE referral_commission_settings
             SET product_purchase_pool_percentage = COALESCE($1, product_purchase_pool_percentage),
                 ad_purchase_pool_percentage      = COALESCE($2, ad_purchase_pool_percentage),
                 updated_at                       = CURRENT_TIMESTAMP
             WHERE id = (SELECT id FROM referral_commission_settings ORDER BY id ASC LIMIT 1)
             RETURNING *`,
            [productPurchasePoolPercentage ?? null, adPurchasePoolPercentage ?? null]
        );
        return res.json({ success: true, data: rows[0], message: 'Commission settings saved' });
    } catch (err) {
        console.error('updateCommissionSettings:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to save commission settings' });
    }
};

module.exports = {
    getLevels,
    addLevel,
    bulkSaveLevels,
    updateLevel,
    deleteLevel,
    getCommissionSettings,
    updateCommissionSettings,
};
