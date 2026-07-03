const pool = require('../config/database');
const { ensureCustomizationSchema } = require('./customizationController');

const parseCommission = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number.parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
};

/**
 * GET /api/categories/:id/commission
 * Public — returns the commission_percent for a main (level 1) category.
 * Used by the Product Add modal to auto-fill Googer Commission when a
 * main category is selected.
 */
exports.getCategoryCommission = async (req, res) => {
    try {
        await ensureCustomizationSchema();
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({ success: false, message: 'Invalid category ID' });
        }

        const result = await pool.query(
            `SELECT id, name, commission_percentage AS commission_percent
             FROM managed_categories
             WHERE id = $1 AND is_active = true AND level = 1
             LIMIT 1`,
            [id]
        );

        const row = result.rows[0];
        if (!row) {
            return res.status(404).json({ success: false, message: 'Main category not found' });
        }

        res.json({
            success: true,
            categoryId: row.id,
            name: row.name,
            commissionPercent: Number(row.commission_percent || 0),
        });
    } catch (error) {
        console.error('Get category commission error:', error);
        res.status(500).json({ success: false, message: 'Failed to get category commission' });
    }
};

/**
 * PATCH /api/admin/customization/categories/:id/commission
 * Admin — updates commission_percentage for a main (level 1) category.
 * Validates range [0, 100].
 */
exports.updateCategoryCommission = async (req, res) => {
    try {
        await ensureCustomizationSchema();
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({ success: false, message: 'Invalid category ID' });
        }

        const value = parseCommission(req.body?.commissionPercent);
        if (value === null) {
            return res.status(400).json({ success: false, message: 'commissionPercent is required' });
        }
        if (value < 0) {
            return res.status(400).json({ success: false, message: 'Commission cannot be negative' });
        }
        if (value > 100) {
            return res.status(400).json({ success: false, message: 'Commission cannot exceed 100%' });
        }

        const result = await pool.query(
            `UPDATE managed_categories
             SET commission_percentage = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND is_active = true AND level = 1
             RETURNING id, name, commission_percentage AS commission_percent`,
            [value, id]
        );

        if (!result.rows[0]) {
            return res.status(404).json({ success: false, message: 'Main category not found' });
        }

        res.json({
            success: true,
            category: {
                id: result.rows[0].id,
                name: result.rows[0].name,
                commissionPercent: Number(result.rows[0].commission_percent),
            },
        });
    } catch (error) {
        console.error('Update category commission error:', error);
        res.status(500).json({ success: false, message: 'Failed to update category commission' });
    }
};
