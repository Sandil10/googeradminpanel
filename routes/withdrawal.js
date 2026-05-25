const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/withdrawal/settings
router.get('/settings', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM withdrawal_settings ORDER BY id LIMIT 1');
    res.json({ success: true, data: r.rows[0] || { min_amount: 50, max_amount: 10000 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// GET /api/withdrawal/payment-methods  (active only)
router.get('/payment-methods', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM withdrawal_payment_methods WHERE is_active = true ORDER BY created_at ASC'
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch payment methods' });
  }
});

// GET /api/withdrawal/requests  (current user's own requests)
router.get('/requests', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT wr.*, wpm.name AS method_display_name, wpm.icon AS method_icon
       FROM withdrawal_requests wr
       LEFT JOIN withdrawal_payment_methods wpm ON wpm.id = wr.payment_method_id
       WHERE wr.user_id = $1
       ORDER BY wr.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
});

// POST /api/withdrawal/request  — submit a withdrawal, deduct wallet immediately
router.post('/request', async (req, res) => {
  const { payment_method_id, amount, payment_details } = req.body;
  const userId = req.user.id;

  if (!payment_method_id || !amount || !payment_details) {
    return res.status(400).json({ success: false, message: 'payment_method_id, amount, and payment_details are required' });
  }

  const withdrawAmount = parseFloat(amount);
  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid amount' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate against withdrawal settings
    const settingsRes = await client.query('SELECT * FROM withdrawal_settings ORDER BY id LIMIT 1');
    const settings = settingsRes.rows[0] || { min_amount: 50, max_amount: 10000 };
    if (withdrawAmount < parseFloat(settings.min_amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Minimum withdrawal amount is R ${settings.min_amount}` });
    }
    if (withdrawAmount > parseFloat(settings.max_amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Maximum withdrawal amount is R ${settings.max_amount}` });
    }

    // Validate payment method is active
    const methodRes = await client.query(
      'SELECT * FROM withdrawal_payment_methods WHERE id = $1 AND is_active = true',
      [payment_method_id]
    );
    if (!methodRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Invalid or inactive payment method' });
    }
    const method = methodRes.rows[0];

    // Lock user row and check balance
    const userRes = await client.query(
      'SELECT id, wallet_balance, hold_balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (!userRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userRes.rows[0];
    if (parseFloat(user.wallet_balance) < withdrawAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    // Deduct from wallet_balance, add to hold_balance
    await client.query(
      `UPDATE users
       SET wallet_balance = wallet_balance - $1,
           hold_balance   = hold_balance   + $1
       WHERE id = $2`,
      [withdrawAmount, userId]
    );

    // Find Googer system account
    const googerRes = await client.query(
      `SELECT id FROM users WHERE LOWER(username) = 'admin' OR LOWER(user_type) = 'super_admin' ORDER BY id LIMIT 1`
    );
    const googerId = googerRes.rows[0]?.id || null;

    // Create wallet_transfer — status=accepted so it immediately registers on Googer Balance.
    // commission=amount records the full withdrawal as Googer income (held until payout/refund).
    const wtRes = await client.query(
      `INSERT INTO wallet_transfers
         (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage)
       VALUES ($1, $2, $3, $4, 'withdrawal_hold', 'accepted', $5, 100)
       RETURNING id`,
      [userId, googerId, withdrawAmount, `Withdrawal request — ${method.name}`, withdrawAmount]
    );
    const walletTransferId = wtRes.rows[0].id;

    // Create withdrawal request
    const wrRes = await client.query(
      `INSERT INTO withdrawal_requests
         (user_id, payment_method_id, payment_method_name, amount, payment_details, status, wallet_transfer_id)
       VALUES ($1, $2, $3, $4, $5, 'Pending', $6)
       RETURNING *`,
      [
        userId,
        payment_method_id,
        method.name,
        withdrawAmount,
        JSON.stringify(payment_details),
        walletTransferId,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: wrRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to submit withdrawal request' });
  } finally {
    client.release();
  }
});

module.exports = router;
