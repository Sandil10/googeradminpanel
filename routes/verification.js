const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.use(authMiddleware, adminOnly);

// Ensure required columns exist
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_verifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'Under Review',
      rejection_reason TEXT,
      full_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      date_of_birth DATE,
      country VARCHAR(100),
      document_type VARCHAR(50),
      id_number VARCHAR(100),
      doc_front_url TEXT,
      doc_back_url TEXT,
      official_website TEXT,
      social_links TEXT,
      news_links TEXT,
      brand_proof_url TEXT,
      vat_number VARCHAR(100),
      business_website TEXT,
      business_reg_url TEXT,
      company_docs_url TEXT,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'None'
  `).catch(() => {});
}

ensureSchema();

// GET /api/verification/admin/all  — optional ?status=
router.get('/admin/all', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE v.status = $1`;
    }

    const result = await pool.query(
      `SELECT
         v.*,
         u.username,
         u.user_id AS readable_user_id,
         u.user_type,
         u.profile_picture,
         u.is_verified,
         u.verification_status AS user_verification_status
       FROM user_verifications v
       JOIN users u ON u.id = v.user_id
       ${where}
       ORDER BY v.submitted_at DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Verification admin/all error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch verifications' });
  }
});

// GET /api/verification/admin/user/:userId  — get a single user's latest verification
router.get('/admin/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT
         v.*,
         u.username,
         u.user_id AS readable_user_id,
         u.user_type,
         u.profile_picture,
         u.is_verified,
         u.verification_status AS user_verification_status
       FROM user_verifications v
       JOIN users u ON u.id = v.user_id
       WHERE v.user_id = $1
       ORDER BY v.submitted_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No verification request found for this user' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Verification user fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch verification' });
  }
});

// PUT /api/verification/admin/:id/review  — approve or reject
router.put('/admin/:id/review', async (req, res) => {
  const { id } = req.params;
  const { action, rejectionReason } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' });
  }
  if (action === 'reject' && !rejectionReason?.trim()) {
    return res.status(400).json({ success: false, message: 'rejectionReason is required when rejecting' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const verif = await client.query(
      'SELECT id, user_id FROM user_verifications WHERE id = $1',
      [id]
    );
    if (verif.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Verification not found' });
    }

    const { user_id } = verif.rows[0];

    if (action === 'approve') {
      await client.query(
        `UPDATE user_verifications
         SET status = 'Verified', reviewed_at = NOW(), updated_at = NOW(), rejection_reason = NULL
         WHERE id = $1`,
        [id]
      );
      await client.query(
        `UPDATE users SET is_verified = true, verification_status = 'Verified' WHERE id = $1`,
        [user_id]
      );
    } else {
      await client.query(
        `UPDATE user_verifications
         SET status = 'Rejected', rejection_reason = $1, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [rejectionReason.trim(), id]
      );
      await client.query(
        `UPDATE users SET is_verified = false, verification_status = 'Rejected' WHERE id = $1`,
        [user_id]
      );
    }

    await client.query('COMMIT');

    const updated = await pool.query(
      `SELECT v.*, u.username, u.user_id AS readable_user_id, u.is_verified, u.verification_status AS user_verification_status
       FROM user_verifications v JOIN users u ON u.id = v.user_id
       WHERE v.id = $1`,
      [id]
    );

    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verification review error:', err);
    res.status(500).json({ success: false, message: 'Failed to update verification' });
  } finally {
    client.release();
  }
});

module.exports = router;
