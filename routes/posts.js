const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Create test link
router.post('/test-link', async (req, res) => {
    try {
        const { link } = req.body;
        console.log('Test link received:', link);
        res.json({ success: true, message: 'Test link added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin list: newest posts first with user details
router.get('/admin-feed', async (req, res) => {
    try {
        const { limit = 100, offset = 0, search = '' } = req.query;
        const normalizedSearch = String(search || '').trim();

        const result = await pool.query(
            `SELECT
                gp.id,
                gp.user_id,
                gp.text,
                gp.text_color,
                gp.likes_count,
                gp.comments_count,
                gp.views_count,
                gp.shares_count,
                gp.created_at,
                gp.updated_at,
                gp.share_code,
                u.username,
                u.full_name,
                u.user_id AS googer_user_id,
                u.email,
                u.profile_picture
             FROM goog_posts gp
             LEFT JOIN users u ON gp.user_id = u.id
             WHERE (
                $1 = ''
                OR COALESCE(gp.text, '') ILIKE '%' || $1 || '%'
                OR COALESCE(u.full_name, '') ILIKE '%' || $1 || '%'
                OR COALESCE(u.username, '') ILIKE '%' || $1 || '%'
                OR COALESCE(u.email, '') ILIKE '%' || $1 || '%'
                OR COALESCE(u.user_id, '') ILIKE '%' || $1 || '%'
             )
             ORDER BY gp.created_at DESC
             LIMIT $2 OFFSET $3`,
            [normalizedSearch, Number(limit), Number(offset)]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Home feed: today's posts shuffled first, then older posts newest-first
router.get('/feed', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const result = await pool.query(
            `SELECT
                p.id,
                p.user_id,
                p.text,
                p.text_color,
                p.likes_count,
                p.comments_count,
                p.views_count,
                p.shares_count,
                p.created_at,
                p.updated_at,
                p.share_code,
                u.full_name,
                u.username,
                u.user_id AS googer_user_id,
                u.profile_picture,
                CASE WHEN DATE(p.created_at AT TIME ZONE 'UTC') = CURRENT_DATE THEN 0 ELSE 1 END AS bucket,
                CASE
                    WHEN DATE(p.created_at AT TIME ZONE 'UTC') = CURRENT_DATE THEN RANDOM()
                    ELSE -EXTRACT(EPOCH FROM p.created_at)
                END AS sort_key
             FROM goog_posts p
             LEFT JOIN users u ON p.user_id = u.id
             ORDER BY bucket ASC, sort_key ASC
             LIMIT $1 OFFSET $2`,
            [Number(limit), Number(offset)]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
