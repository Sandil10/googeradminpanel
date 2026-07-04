const pool = require('../config/database');

const AD_TYPES = ['photo_video_ad', 'product_promote_ad', 'profile_promote_ad'];

const ensureReachSettingsTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reach_settings (
            id SERIAL PRIMARY KEY,
            ad_type VARCHAR(50) NOT NULL UNIQUE,
            min_multiplier DECIMAL(10,2) NOT NULL DEFAULT 300,
            max_multiplier DECIMAL(10,2) NOT NULL DEFAULT 500,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Seed default rows if they don't exist yet
    for (const ad_type of AD_TYPES) {
        await pool.query(
            `INSERT INTO reach_settings (ad_type, min_multiplier, max_multiplier)
             VALUES ($1, 300, 500)
             ON CONFLICT (ad_type) DO NOTHING`,
            [ad_type]
        );
    }
};

const getAll = async (req, res) => {
    try {
        await ensureReachSettingsTable();
        const result = await pool.query(
            'SELECT * FROM reach_settings ORDER BY ad_type ASC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

const update = async (req, res) => {
    try {
        await ensureReachSettingsTable();
        const { ad_type } = req.params;
        const { min_multiplier, max_multiplier } = req.body;

        if (!AD_TYPES.includes(ad_type)) {
            return res.status(400).json({ message: `ad_type must be one of: ${AD_TYPES.join(', ')}` });
        }

        const minVal = Number(min_multiplier);
        const maxVal = Number(max_multiplier);

        if (!Number.isFinite(minVal) || minVal <= 0) {
            return res.status(400).json({ message: 'min_multiplier must be a positive number' });
        }
        if (!Number.isFinite(maxVal) || maxVal <= 0) {
            return res.status(400).json({ message: 'max_multiplier must be a positive number' });
        }
        if (maxVal <= minVal) {
            return res.status(400).json({ message: 'max_multiplier must be greater than min_multiplier' });
        }

        const result = await pool.query(
            `UPDATE reach_settings
             SET min_multiplier = $1, max_multiplier = $2, updated_at = CURRENT_TIMESTAMP
             WHERE ad_type = $3
             RETURNING *`,
            [minVal, maxVal, ad_type]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Reach settings not found for this ad type' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// Public endpoint — mobile app uses this to display reach estimate
const getPublic = async (req, res) => {
    try {
        await ensureReachSettingsTable();
        const result = await pool.query(
            'SELECT ad_type, min_multiplier, max_multiplier FROM reach_settings ORDER BY ad_type ASC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAll, update, getPublic };
