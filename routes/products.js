const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.use(authMiddleware, adminOnly);

// Get all products
router.get('/all', async (req, res) => {
  try {
    const { status, userId } = req.query;
    let query = `
      SELECT m.*,
             m.user_id as user_id,
             m.seller_id as seller_id,
             COALESCE(u.username, m.username) as username,
             u.full_name,
             u.user_id as seller_public_id,
             COALESCE(mv.view_count, 0) as real_views
      FROM market m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN (SELECT market_id, COUNT(*) as view_count FROM market_views GROUP BY market_id) mv ON mv.market_id = m.id
    `;
    let params = [];
    let conditions = [];

    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      params.push(statusArray);
      conditions.push(`m.status = ANY($${params.length})`);
    } else {
      // By default, exclude soft-deleted products
      conditions.push(`m.status != 'deleted'`);
    }

    if (userId) {
      params.push(userId);
      conditions.push(`m.user_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY m.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT m.*,
             m.user_id as user_id,
             m.seller_id as seller_id,
             COALESCE(u.username, m.username) as username,
             u.full_name,
             u.user_id as seller_public_id,
             COALESCE(mv.view_count, 0) as real_views
      FROM market m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN (SELECT market_id, COUNT(*) as view_count FROM market_views GROUP BY market_id) mv ON mv.market_id = m.id
      WHERE m.id = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// The listing's "posted" time (feed "5 min ago") counts from approval, not
// from submission, so approval stamps active_start_time.
let activeStartColumnReady = null;
const ensureActiveStartColumn = () => {
  if (!activeStartColumnReady) {
    activeStartColumnReady = pool
      .query('ALTER TABLE market ADD COLUMN IF NOT EXISTS active_start_time TIMESTAMP')
      .catch((err) => { activeStartColumnReady = null; throw err; });
  }
  return activeStartColumnReady;
};

// Update product status (Approve, Reject, Activate, Deactivate)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await ensureActiveStartColumn();
    // Only a move from review (reviewing/pending/rejected) to live restarts the
    // clock; active <-> inactive toggles keep the original approval time.
    const result = await pool.query(
      `UPDATE market
          SET active_start_time = CASE
                WHEN $1 IN ('approved', 'active')
                 AND COALESCE(status, '') NOT IN ('approved', 'active', 'inactive')
                THEN NOW()
                ELSE active_start_time
              END,
              status = $1
        WHERE id = $2
        RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM market WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted successfully', product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

module.exports = router;
