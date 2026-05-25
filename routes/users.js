const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.use(authMiddleware, adminOnly);

// Create a new user (admin)
router.post('/', async (req, res) => {
  const { user_id, user_type, username, full_name, email, password, confirm_password } = req.body;

  if (!user_id || !user_type || !username || !full_name || !email || !password || !confirm_password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  if (!/^\d{6}$/.test(user_id)) {
    return res.status(400).json({ message: 'User ID must be exactly 6 digits.' });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  try {
    // Expand user_id column to accept 6+ digits if it was VARCHAR(4)
    await pool.query(`ALTER TABLE users ALTER COLUMN user_id TYPE VARCHAR(20)`).catch(() => {});

    // Check uniqueness
    const exists = await pool.query(
      'SELECT user_id, email, username FROM users WHERE user_id = $1 OR email = $2 OR username = $3',
      [user_id, email, username]
    );
    if (exists.rows.length > 0) {
      const dup = exists.rows[0];
      if (dup.user_id === user_id)   return res.status(409).json({ message: 'User ID already in use.' });
      if (dup.email === email)       return res.status(409).json({ message: 'Email already registered.' });
      if (dup.username === username) return res.status(409).json({ message: 'Username already taken.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const cleanName = username.substring(0, 3).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referralCode = `REF-${cleanName}-${randomStr}`;

    const normalizedType = user_type.toLowerCase();

    const result = await pool.query(
      `INSERT INTO users (user_id, username, full_name, email, password, user_type, referral_code, wallet_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, username, full_name, email, user_type, profile_picture, referral_code, wallet_balance, created_at`,
      [user_id, username, full_name, email, hashedPassword, normalizedType, referralCode, 0.00]
    );

    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Admin create user error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get all users
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE marked_for_deletion_at IS NULL ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    // If the marked_for_deletion_at column doesn't exist yet (Vercel production DB missing it)
    if (err.code === '42703') {
      try {
        console.log("Auto-adding missing column 'marked_for_deletion_at' on the fly...");
        await pool.query("ALTER TABLE users ADD COLUMN marked_for_deletion_at TIMESTAMP DEFAULT NULL");
        const retryResult = await pool.query("SELECT * FROM users WHERE marked_for_deletion_at IS NULL ORDER BY created_at DESC");
        return res.json(retryResult.rows);
      } catch (retryErr) {
        console.error("Migration fallback failed:", retryErr);
      }
    }
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Get deactivated users (both marked for deletion and manually deactivated)
router.get('/deactivated', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE marked_for_deletion_at IS NOT NULL OR status = 'Deactivated' ORDER BY marked_for_deletion_at DESC, created_at DESC");
    res.json(result.rows);
  } catch (err) {
    if (err.code === '42703') {
      try {
        console.log("Auto-adding missing column 'marked_for_deletion_at' on the fly...");
        await pool.query("ALTER TABLE users ADD COLUMN marked_for_deletion_at TIMESTAMP DEFAULT NULL");
        const retryResult = await pool.query("SELECT * FROM users WHERE marked_for_deletion_at IS NOT NULL OR status = 'Deactivated' ORDER BY marked_for_deletion_at DESC, created_at DESC");
        return res.json(retryResult.rows);
      } catch (retryErr) {
        console.error("Migration fallback failed:", retryErr);
      }
    }
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Get user details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    
    // Fetch wallet history or other details if needed
    const user = result.rows[0];
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Update user status (Activate/Deactivate)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Get user transaction history and earnings
router.get('/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch all accepted transactions where user is receiver
    const transactions = await pool.query(
      `SELECT t.*, 
              s.username as sender_username, s.full_name as sender_full_name, s.user_id as sender_readable_id,
              r.username as receiver_username, r.full_name as receiver_full_name, r.user_id as receiver_readable_id
       FROM wallet_transfers t
       JOIN users s ON t.sender_id = s.id
       JOIN users r ON t.receiver_id = r.id
       WHERE (t.sender_id = $1 OR t.receiver_id = $1)
       ORDER BY t.created_at DESC`,
      [id]
    );

    // Calculate total earnings (accepted transactions where user is receiver)
    // For 'sell' type, receiver gets (amount - commission)
    const earningsResult = await pool.query(
      `SELECT SUM(
         CASE 
           WHEN type = 'sell' THEN amount - COALESCE(commission, 0)
           ELSE amount 
         END
       ) as total_earnings
       FROM wallet_transfers 
       WHERE receiver_id = $1 AND status = 'accepted'`,
      [id]
    );

    res.json({
      transactions: transactions.rows,
      totalEarnings: earningsResult.rows[0].total_earnings || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Soft delete user (mark for deletion)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE users SET marked_for_deletion_at = CURRENT_TIMESTAMP, status = 'Deactivated' WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User marked for deletion successfully (Soft Delete)', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Permanently delete user
router.delete('/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User permanently deleted successfully', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Restore soft-deleted user
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE users SET marked_for_deletion_at = NULL, status = 'Active' WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User restored successfully', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

module.exports = router;
