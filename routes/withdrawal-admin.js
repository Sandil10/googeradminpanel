const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const { writeAdminAuditEvent } = require('../utils/adminAuditLogger');
const { getLockedGoogerPooledState, normalizeMoney } = require('../../shared/utils/financeBoundary');
const {
  consumeHeldWalletFunds,
  refundHeldWalletFunds,
  creditWalletAndRecordTransfer,
  insertWalletTransfer,
} = require('../../shared/utils/financeCommands');
const { claimFinanceIdempotencyKey, completeFinanceIdempotencyKey } = require('../../shared/utils/financeIdempotency');

router.use(authMiddleware, adminOnly);

async function audit(req, event) {
  try {
    await writeAdminAuditEvent(req, event);
  } catch (err) {
    console.error('[admin-audit] failed to write log:', err.message);
  }
}

function getIdempotencyKey(req) {
  const value = req.get('x-idempotency-key');
  return value ? value.trim() : null;
}

router.get('/settings', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM withdrawal_settings ORDER BY id LIMIT 1');
    res.json({ success: true, data: r.rows[0] || { min_amount: 50, max_amount: 10000 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

router.put('/settings', async (req, res) => {
  const { min_amount, max_amount } = req.body;
  if (min_amount === undefined || max_amount === undefined) {
    return res.status(400).json({ success: false, message: 'min_amount and max_amount are required' });
  }
  if (Number(min_amount) >= Number(max_amount)) {
    return res.status(400).json({ success: false, message: 'min_amount must be less than max_amount' });
  }
  try {
    await pool.query(
      `UPDATE withdrawal_settings
       SET min_amount = $1, max_amount = $2, updated_at = NOW()
       WHERE id = (SELECT id FROM withdrawal_settings ORDER BY id LIMIT 1)`,
      [min_amount, max_amount]
    );
    const r = await pool.query('SELECT * FROM withdrawal_settings ORDER BY id LIMIT 1');
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

router.get('/payment-methods', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM withdrawal_payment_methods ORDER BY created_at DESC');
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch payment methods' });
  }
});

router.post('/payment-methods', async (req, res) => {
  const { name, icon, fields, is_active } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
  try {
    const r = await pool.query(
      `INSERT INTO withdrawal_payment_methods (name, icon, fields, is_active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), icon || 'cash-outline', JSON.stringify(fields || []), is_active !== false]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create payment method' });
  }
});

router.patch('/payment-methods/:id', async (req, res) => {
  const { id } = req.params;
  const { name, icon, fields, is_active } = req.body;
  try {
    const updates = [];
    const vals = [];
    let idx = 1;
    if (name !== undefined)      { updates.push(`name = $${idx++}`); vals.push(name.trim()); }
    if (icon !== undefined)      { updates.push(`icon = $${idx++}`); vals.push(icon); }
    if (fields !== undefined)    { updates.push(`fields = $${idx++}`); vals.push(JSON.stringify(fields)); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); vals.push(is_active); }
    if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    updates.push('updated_at = NOW()');
    vals.push(id);
    const r = await pool.query(
      `UPDATE withdrawal_payment_methods SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!r.rows.length) return res.status(404).json({ success: false, message: 'Payment method not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update payment method' });
  }
});

router.delete('/payment-methods/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM withdrawal_payment_methods WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete payment method' });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status && status !== 'All') {
      params.push(status);
      where = `WHERE wr.status = $1`;
    }
    const r = await pool.query(
      `SELECT
         wr.*,
         u.username,
         u.user_id   AS readable_user_id,
         u.full_name,
         u.email,
         u.user_type,
         u.profile_picture,
         u.wallet_balance
       FROM withdrawal_requests wr
       JOIN users u ON u.id = wr.user_id
       ${where}
       ORDER BY wr.created_at DESC`,
      params
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
});

router.put('/requests/:id/review', async (req, res) => {
  const { id } = req.params;
  const { action, rejectionReason } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'action must be approve or reject' });
  }
  if (action === 'reject' && !rejectionReason?.trim()) {
    return res.status(400).json({ success: false, message: 'rejectionReason required when rejecting' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const idempotency = await claimFinanceIdempotencyKey(client, {
      scope: 'admin.withdrawal.review',
      idempotencyKey: getIdempotencyKey(req),
      requestPayload: { id: Number(id), action, rejectionReason: rejectionReason?.trim() || null },
      actorUserId: req.user?.id || null,
      amount: null,
    });
    if (idempotency.state === 'mismatch') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Idempotency key was already used for a different request.' });
    }
    if (idempotency.state === 'in_progress') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'This finance action is already being processed.' });
    }
    if (idempotency.state === 'replay') {
      await client.query('ROLLBACK');
      return res.json(idempotency.responseBody);
    }

    const wr = await client.query('SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE', [id]);
    if (!wr.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    const row = wr.rows[0];
    if (row.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Request already processed' });
    }

    const googerState = await getLockedGoogerPooledState(client);
    const googerId = googerState?.userId || null;
    if (!googerId) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: 'System wallet is not configured.' });
    }

    if (action === 'approve') {
      await consumeHeldWalletFunds(client, { userId: row.user_id, amount: row.amount });

      if (row.wallet_transfer_id) {
        await client.query(
          `UPDATE wallet_transfers SET status = 'accepted' WHERE id = $1`,
          [row.wallet_transfer_id]
        );
      } else {
        const wt = await creditWalletAndRecordTransfer(client, {
          senderId: row.user_id,
          receiverId: googerId,
          amount: row.amount,
          note: `Withdrawal approved - ${row.payment_method_name || 'N/A'}`,
          type: 'withdrawal_hold',
          status: 'accepted',
          commission: 0,
          commissionPercentage: 0,
          creditWallet: false,
        });
        await client.query(
          `UPDATE withdrawal_requests SET wallet_transfer_id = $1 WHERE id = $2`,
          [wt.walletTransferId, id]
        );
      }

      await insertWalletTransfer(client, {
        senderId: googerId,
        receiverId: googerId,
        amount: row.amount,
        note: `Withdrawal payout - ${row.payment_method_name || 'N/A'}`,
        type: 'system_payout',
        status: 'accepted',
        commission: -normalizeMoney(row.amount),
        commissionPercentage: 0,
      });

      await client.query(
        `UPDATE withdrawal_requests SET status = 'Approved', reviewed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [id]
      );
    } else {
      await refundHeldWalletFunds(client, { userId: row.user_id, amount: row.amount });

      if (googerId) {
        await client.query(
          `UPDATE users SET wallet_balance = GREATEST(wallet_balance - $1, 0) WHERE id = $2`,
          [row.amount, googerId]
        );
      }

      if (row.wallet_transfer_id) {
        await client.query(
          `UPDATE wallet_transfers SET status = 'refunded' WHERE id = $1`,
          [row.wallet_transfer_id]
        );
      }

      await creditWalletAndRecordTransfer(client, {
        senderId: googerId,
        receiverId: row.user_id,
        amount: row.amount,
        note: `Withdrawal refunded - ${rejectionReason.trim()}`,
        type: 'withdrawal_refund',
        status: 'accepted',
        commission: 0,
        commissionPercentage: 0,
        creditWallet: false,
      });

      await client.query(
        `UPDATE withdrawal_requests SET status = 'Rejected', rejection_reason = $1, reviewed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [rejectionReason.trim(), id]
      );
    }

    const updated = await client.query(
      `SELECT wr.*, u.username, u.full_name, u.email, u.wallet_balance, u.hold_balance
       FROM withdrawal_requests wr JOIN users u ON u.id = wr.user_id WHERE wr.id = $1`,
      [id]
    );
    const responseBody = { success: true, data: updated.rows[0] };
    if (idempotency.recordId) {
      await completeFinanceIdempotencyKey(client, idempotency.recordId, responseBody);
    }
    await client.query('COMMIT');
    await audit(req, {
      action: 'admin.withdrawal.review',
      status: 'success',
      target: { withdrawalRequestId: Number(id), userId: row.user_id },
      amount: parseFloat(row.amount || 0),
      details: {
        decision: action,
        paymentMethod: row.payment_method_name || null,
        rejectionReason: action === 'reject' ? rejectionReason.trim() : null,
      },
    });
    res.json(responseBody);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    await audit(req, {
      action: 'admin.withdrawal.review',
      status: 'error',
      target: { withdrawalRequestId: Number(id) || null },
      details: { decision: action || null },
      error: err.message,
    });
    res.status(500).json({ success: false, message: 'Failed to process request' });
  } finally {
    client.release();
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        wt.id,
        wt.type,
        wt.amount,
        wt.note,
        wt.status,
        wt.created_at,
        s.id          AS sender_db_id,
        s.username    AS sender_username,
        s.full_name   AS sender_name,
        s.user_id     AS sender_readable_id,
        s.profile_picture AS sender_pic,
        rcv.id        AS receiver_db_id,
        rcv.username  AS receiver_username,
        rcv.full_name AS receiver_name,
        rcv.user_id   AS receiver_readable_id,
        rcv.profile_picture AS receiver_pic
      FROM wallet_transfers wt
      LEFT JOIN users s   ON s.id = wt.sender_id
      LEFT JOIN users rcv ON rcv.id = wt.receiver_id
      WHERE wt.type IN ('withdrawal_hold', 'withdrawal_refund')
      ORDER BY wt.created_at DESC
      LIMIT 200
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
});

module.exports = router;
