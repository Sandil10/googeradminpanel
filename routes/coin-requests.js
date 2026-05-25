const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// ─── Public user-facing route (auth required, no admin check) ────────────────
router.get('/active-topup-methods', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, icon, category, fields FROM topup_payment_methods WHERE is_active = true ORDER BY created_at ASC`
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch topup methods' });
  }
});

router.use(authMiddleware, adminOnly);

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS topup_payment_methods (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      icon VARCHAR(60) NOT NULL DEFAULT 'cash-outline',
      fields JSONB NOT NULL DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(`
    ALTER TABLE topup_payment_methods ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'Other'
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coin_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payment_method_id INTEGER REFERENCES topup_payment_methods(id) ON DELETE SET NULL,
      payment_method_name VARCHAR(100),
      amount NUMERIC(12,2) NOT NULL,
      payment_details JSONB NOT NULL DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      rejection_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
}
ensureSchema();

// ─── Topup Payment Methods ────────────────────────────────────────────────────

router.get('/topup-methods', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM topup_payment_methods ORDER BY created_at DESC');
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch topup methods' });
  }
});

router.post('/topup-methods', async (req, res) => {
  const { name, icon, fields, is_active, category } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
  try {
    const r = await pool.query(
      `INSERT INTO topup_payment_methods (name, icon, fields, is_active, category)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), icon || 'cash-outline', JSON.stringify(fields || []), is_active !== false, category || 'Other']
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create topup method' });
  }
});

router.patch('/topup-methods/:id', async (req, res) => {
  const { id } = req.params;
  const { name, icon, fields, is_active, category } = req.body;
  try {
    const updates = [];
    const vals = [];
    let idx = 1;
    if (name !== undefined)      { updates.push(`name = $${idx++}`);      vals.push(name.trim()); }
    if (icon !== undefined)      { updates.push(`icon = $${idx++}`);      vals.push(icon); }
    if (fields !== undefined)    { updates.push(`fields = $${idx++}`);    vals.push(JSON.stringify(fields)); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); vals.push(is_active); }
    if (category !== undefined)  { updates.push(`category = $${idx++}`);  vals.push(category); }
    if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    updates.push(`updated_at = NOW()`);
    vals.push(id);
    const r = await pool.query(
      `UPDATE topup_payment_methods SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!r.rows.length) return res.status(404).json({ success: false, message: 'Method not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update topup method' });
  }
});

router.delete('/topup-methods/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM topup_payment_methods WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete topup method' });
  }
});

// ─── Coin Requests (Admin) ────────────────────────────────────────────────────

router.get('/admin/requests', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status && status !== 'All') {
      params.push(status);
      where = `WHERE cr.status = $1`;
    }
    const r = await pool.query(
      `SELECT
         cr.*,
         u.username,
         u.user_id   AS readable_user_id,
         u.full_name,
         u.email,
         u.user_type,
         u.profile_picture,
         u.wallet_balance
       FROM coin_requests cr
       JOIN users u ON u.id = cr.user_id
       ${where}
       ORDER BY cr.created_at DESC`,
      params
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch coin requests' });
  }
});

// PUT /api/coin-requests/admin/:id/review  { action: 'approve'|'reject', rejection_reason? }
router.put('/admin/:id/review', async (req, res) => {
  const { id } = req.params;
  const { action, rejection_reason } = req.body;
  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ success: false, message: 'action must be approve or reject' });
  if (action === 'reject' && !rejection_reason?.trim())
    return res.status(400).json({ success: false, message: 'rejection_reason required when rejecting' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cr = await client.query('SELECT * FROM coin_requests WHERE id = $1 FOR UPDATE', [id]);
    if (!cr.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    const row = cr.rows[0];
    if (row.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Request already processed' });
    }

    if (action === 'approve') {
      // Credit user wallet
      await client.query(
        `UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
        [row.amount, row.user_id]
      );
      // Googer system wallet (debit)
      const googerRes = await client.query(
        `SELECT id FROM users WHERE LOWER(username) = 'admin' OR LOWER(user_type) = 'super_admin' ORDER BY id LIMIT 1`
      );
      const googerId = googerRes.rows[0]?.id || null;
      if (googerId) {
        await client.query(
          `INSERT INTO wallet_transfers (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage)
           VALUES ($1, $2, $3, $4, 'topup_approved', 'accepted', 0, 0)`,
          [googerId, row.user_id, row.amount, `Top-up approved — ${row.payment_method_name || 'N/A'}`]
        );
      }
      await client.query(
        `UPDATE coin_requests SET status = 'Verified', reviewed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [id]
      );
    } else {
      await client.query(
        `UPDATE coin_requests SET status = 'Rejected', rejection_reason = $1, reviewed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [rejection_reason.trim(), id]
      );
    }

    await client.query('COMMIT');
    const updated = await pool.query(
      `SELECT cr.*, u.username, u.full_name, u.email, u.wallet_balance
       FROM coin_requests cr JOIN users u ON u.id = cr.user_id WHERE cr.id = $1`,
      [id]
    );
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  } finally {
    client.release();
  }
});

module.exports = router;
