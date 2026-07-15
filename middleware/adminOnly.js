const pool = require('../config/database');
const { normalizeRole } = require('../../shared/contracts/userRoles');

const allowedRoles = new Set(['admin', 'super_admin', 'superadmin']);

const adminOnly = async (req, res, next) => {
    try {
        const userId = Number(req.user?.id || 0);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const result = await pool.query(
            `SELECT id, user_type, status, is_deactivated, marked_for_deletion_at
             FROM users
             WHERE id = $1
             LIMIT 1`,
            [userId]
        );

        const user = result.rows[0];
        const userType = normalizeRole(user?.user_type);
        const isActive = user
            && !user.is_deactivated
            && !user.marked_for_deletion_at
            && normalizeRole(user.status || 'active') !== 'deactivated';

        if (isActive && allowedRoles.has(userType)) {
            return next();
        }

        return res.status(403).json({ success: false, message: 'Access denied. Only Admin or Super Admin accounts can use this panel.' });
    } catch (error) {
        console.error('Admin access error:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify admin access' });
    }
};

module.exports = adminOnly;
