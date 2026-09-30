const pool = require('../config/database');

const AD_TYPES = ['photo_video', 'product_promote', 'profile_promote'];
const SETTING_KEY = 'ad_allowed_countries';

const ensureTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_customization_settings (
            setting_key VARCHAR(80) PRIMARY KEY,
            setting_value JSONB NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});
};

const getSettings = async () => {
    await ensureTable();
    const result = await pool.query(
        "SELECT setting_value FROM admin_customization_settings WHERE setting_key = $1",
        [SETTING_KEY]
    );
    if (!result.rows.length) return null;
    const value = result.rows[0].setting_value;
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return {}; }
};

// Public — returns allowed country codes per ad type (used by main app)
exports.getPublic = async (req, res) => {
    try {
        const settings = await getSettings();
        res.json({ success: true, allowed_countries: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Admin — returns full settings
exports.getAdmin = async (req, res) => {
    try {
        const settings = await getSettings();
        res.json({ success: true, allowed_countries: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Public catalog stored by the main backend in the shared PostgreSQL database.
// The admin UI uses this instead of the retired REST Countries browser API.
exports.getCountryCatalog = async (_req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS country_catalog (
                code CHAR(2) PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                flag VARCHAR(16) NOT NULL DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        const result = await pool.query(
            'SELECT code, name, flag FROM country_catalog ORDER BY name ASC'
        );
        res.json({ success: true, countries: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Admin — update
exports.update = async (req, res) => {
    try {
        await ensureTable();
        const { allowed_countries } = req.body;
        // Validate: each key must be one of the 3 ad types, values must be arrays of strings
        const sanitized = {};
        for (const type of AD_TYPES) {
            sanitized[type] = Array.isArray(allowed_countries?.[type])
                ? allowed_countries[type].filter(c => typeof c === 'string').map(c => c.trim().toUpperCase()).filter(Boolean)
                : [];
        }
        await pool.query(
            `INSERT INTO admin_customization_settings (setting_key, setting_value, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
            [SETTING_KEY, JSON.stringify(sanitized)]
        );
        res.json({ success: true, allowed_countries: sanitized });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
