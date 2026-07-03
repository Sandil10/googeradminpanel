const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const crypto = require('crypto');

router.use(authMiddleware, adminOnly);

const ensureTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(30) DEFAULT 'info',
            theme_color VARCHAR(200) DEFAULT NULL,
            theme_font_color VARCHAR(40) DEFAULT NULL,
            theme_font_size VARCHAR(20) DEFAULT NULL,
            batch_id VARCHAR(80) DEFAULT NULL,
            batch_count INTEGER DEFAULT NULL,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at DESC)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_notifications_batch_id ON user_notifications(batch_id) WHERE batch_id IS NOT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS theme_color VARCHAR(200) DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS theme_font_color VARCHAR(40) DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS theme_font_size VARCHAR(20) DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS batch_id VARCHAR(80) DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS batch_count INTEGER DEFAULT NULL`).catch(() => {});
    await pool.query(`DELETE FROM user_notifications WHERE created_at < NOW() - INTERVAL '30 days'`).catch(() => {});
};

const ensureChatHistoryTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_chat_send_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            sender_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            batch_id VARCHAR(80) DEFAULT NULL,
            batch_count INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_chat_send_history_created_at ON admin_chat_send_history(created_at DESC)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_chat_send_history_batch_id ON admin_chat_send_history(batch_id) WHERE batch_id IS NOT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE admin_chat_send_history ADD COLUMN IF NOT EXISTS sender_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL`).catch(() => {});
    await pool.query(`ALTER TABLE admin_chat_send_history ADD COLUMN IF NOT EXISTS batch_id VARCHAR(80) DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE admin_chat_send_history ADD COLUMN IF NOT EXISTS batch_count INTEGER DEFAULT NULL`).catch(() => {});
    await pool.query(`DELETE FROM admin_chat_send_history WHERE created_at < NOW() - INTERVAL '30 days'`).catch(() => {});
};

// Send notification to one or more users (optionally filtered by user_type group)
router.post('/send', async (req, res) => {
    try {
        await ensureTable();
        const {
            user_ids,
            user_group,
            title,
            message,
            type = 'info',
            theme_color = null,
            theme_font_color = null,
            theme_font_size = null,
        } = req.body;
        if (!title || !message) return res.status(400).json({ message: 'Title and message required' });

        let targets = [];
        if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
            targets = user_ids;
        } else if (user_group && user_group !== 'all') {
            const rows = await pool.query(
                "SELECT id FROM users WHERE status != 'Deleted' AND user_type = $1",
                [user_group]
            );
            targets = rows.rows.map(r => r.id);
        } else {
            const all = await pool.query("SELECT id FROM users WHERE status != 'Deleted'");
            targets = all.rows.map(r => r.id);
        }

        const cleanTargets = Array.from(new Set(targets.map(Number).filter(Boolean)));
        const batchId = cleanTargets.length > 1 ? crypto.randomUUID() : null;
        const batchCount = cleanTargets.length > 1 ? cleanTargets.length : null;

        for (const uid of cleanTargets) {
            await pool.query(
                `
                    INSERT INTO user_notifications (
                        user_id, title, message, type, theme_color, theme_font_color,
                        theme_font_size, batch_id, batch_count
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `,
                [uid, title, message, type, theme_color || null, theme_font_color || null, theme_font_size || null, batchId, batchCount]
            );
        }

        res.json({ success: true, sent_to: cleanTargets.length, batch_id: batchId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Record admin-initiated chat sends for the admin history table.
router.post('/chat-history', async (req, res) => {
    try {
        await ensureChatHistoryTable();
        const { user_ids, message, sender_admin_id = null } = req.body;
        if (!message || !Array.isArray(user_ids) || user_ids.length === 0) {
            return res.status(400).json({ message: 'Message and users required' });
        }

        const cleanTargets = Array.from(new Set(user_ids.map(Number).filter(Boolean)));
        const batchId = cleanTargets.length > 1 ? crypto.randomUUID() : null;
        const batchCount = cleanTargets.length > 1 ? cleanTargets.length : null;

        for (const uid of cleanTargets) {
            await pool.query(
                `
                    INSERT INTO admin_chat_send_history (
                        user_id, message, sender_admin_id, batch_id, batch_count
                    )
                    VALUES ($1, $2, $3, $4, $5)
                `,
                [uid, message, sender_admin_id ? Number(sender_admin_id) : null, batchId, batchCount]
            );
        }

        res.json({ success: true, sent_to: cleanTargets.length, batch_id: batchId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/chat-history', async (req, res) => {
    try {
        await ensureChatHistoryTable();
        const result = await pool.query(`
            WITH recent_chat_history AS (
                SELECT
                    h.*,
                    u.username,
                    u.full_name,
                    u.user_type,
                    sender.username AS sender_username,
                    sender.full_name AS sender_full_name
                FROM admin_chat_send_history h
                LEFT JOIN users u ON h.user_id = u.id
                LEFT JOIN users sender ON h.sender_admin_id = sender.id
                WHERE h.created_at >= NOW() - INTERVAL '30 days'
            ),
            grouped AS (
                SELECT
                    MIN(id) AS id,
                    NULL::integer AS user_id,
                    message,
                    sender_admin_id,
                    MAX(sender_username) AS sender_username,
                    MAX(sender_full_name) AS sender_full_name,
                    MAX(created_at) AS created_at,
                    batch_id,
                    COALESCE(MAX(batch_count), COUNT(*))::int AS recipient_count,
                    TRUE AS is_bulk,
                    NULL::text AS username,
                    NULL::text AS full_name,
                    ARRAY_REMOVE(ARRAY_AGG(DISTINCT user_type), NULL) AS recipient_user_types
                FROM recent_chat_history
                WHERE batch_id IS NOT NULL
                GROUP BY batch_id, message, sender_admin_id
            ),
            singles AS (
                SELECT
                    id,
                    user_id,
                    message,
                    sender_admin_id,
                    sender_username,
                    sender_full_name,
                    created_at,
                    batch_id,
                    1::int AS recipient_count,
                    FALSE AS is_bulk,
                    username,
                    full_name,
                    ARRAY[user_type] AS recipient_user_types
                FROM recent_chat_history
                WHERE batch_id IS NULL
            )
            SELECT *
            FROM (
                SELECT * FROM grouped
                UNION ALL
                SELECT * FROM singles
            ) rows
            ORDER BY created_at DESC
            LIMIT 200
        `);
        res.json({ chat_history: result.rows });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all sent notifications (admin view)
router.get('/all', async (req, res) => {
    try {
        await ensureTable();
        const result = await pool.query(`
            WITH recent_notifications AS (
                SELECT
                    n.*,
                    u.username,
                    u.full_name,
                    u.user_type
                FROM user_notifications n
                LEFT JOIN users u ON n.user_id = u.id
                WHERE n.created_at >= NOW() - INTERVAL '30 days'
            ),
            grouped AS (
                SELECT
                    MIN(id) AS id,
                    NULL::integer AS user_id,
                    title,
                    message,
                    type,
                    theme_color,
                    theme_font_color,
                    theme_font_size,
                    BOOL_AND(is_read) AS is_read,
                    MAX(created_at) AS created_at,
                    batch_id,
                    COALESCE(MAX(batch_count), COUNT(*))::int AS recipient_count,
                    TRUE AS is_bulk,
                    NULL::text AS username,
                    NULL::text AS full_name,
                    ARRAY_REMOVE(ARRAY_AGG(DISTINCT user_type), NULL) AS recipient_user_types
                FROM recent_notifications
                WHERE batch_id IS NOT NULL
                GROUP BY
                    batch_id, title, message, type, theme_color,
                    theme_font_color, theme_font_size
            ),
            singles AS (
                SELECT
                    id,
                    user_id,
                    title,
                    message,
                    type,
                    theme_color,
                    theme_font_color,
                    theme_font_size,
                    is_read,
                    created_at,
                    batch_id,
                    1::int AS recipient_count,
                    FALSE AS is_bulk,
                    username,
                    full_name,
                    ARRAY[user_type] AS recipient_user_types
                FROM recent_notifications
                WHERE batch_id IS NULL
            )
            SELECT *
            FROM (
                SELECT * FROM grouped
                UNION ALL
                SELECT * FROM singles
            ) rows
            ORDER BY created_at DESC
            LIMIT 200
        `);
        res.json({ notifications: result.rows });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
