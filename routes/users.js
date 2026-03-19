const express = require('express');
const router = express.Router();
const pool = require('../config/database');

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

