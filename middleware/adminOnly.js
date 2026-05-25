const pool = require('../config/database');

const normalizeRole = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const parseList = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const allowedRoles = new Set(['admin', 'super_admin', 'employee', 'administrator']);

const adminOnly = async (req, res, next) => {
    try {
        const userId = Number(req.user?.id || 0);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const result = await pool.query(
            `SELECT id, username, user_type
             FROM users
             WHERE id = $1
             LIMIT 1`,
            [userId]
        );

        const user = result.rows[0];
        const userType = normalizeRole(user?.user_type);
        const allowedIds = parseList(process.env.ADMIN_ACCESS_USER_IDS);
        const allowedUsernames = parseList(process.env.ADMIN_ACCESS_USERNAMES);

        if (
            allowedRoles.has(userType) ||
            allowedIds.includes(String(user?.id)) ||
            allowedUsernames.includes(String(user?.username || '').toLowerCase())
        ) {
            return next();
        }

        const privilegedCount = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM users
             WHERE LOWER(REPLACE(REPLACE(TRIM(COALESCE(user_type, '')), ' ', '_'), '-', '_'))
                   IN ('admin', 'super_admin', 'employee', 'administrator')`
        );

        if (Number(privilegedCount.rows[0]?.count || 0) === 0) {
            console.warn('Admin access bootstrap mode: no privileged users exist yet. Allowing authenticated user.');
            return next();
        }

            return res.status(403).json({ success: false, message: 'Admin access required' });
    } catch (error) {
        console.error('Admin access error:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify admin access' });
    }
};

module.exports = adminOnly;
