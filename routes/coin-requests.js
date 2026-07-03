const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const { sensitiveWriteLimiter } = require('../middleware/rateLimiters');
const { writeAdminAuditEvent } = require('../utils/adminAuditLogger');
const { resolveGoogerMainWalletUserId } = require('../../shared/utils/financeBoundary');
const { creditWalletAndRecordTransfer } = require('../../shared/utils/financeCommands');
const { claimFinanceIdempotencyKey, completeFinanceIdempotencyKey } = require('../../shared/utils/financeIdempotency');

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
router.use(sensitiveWriteLimiter);

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

router.put('/admin/:id/review', async (req, res) => {
  const { id } = req.params;
  const { action, rejection_reason } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'action must be approve or reject' });
  }
  if (action === 'reject' && !rejection_reason?.trim()) {
    return res.status(400).json({ success: false, message: 'rejection_reason required when rejecting' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const idempotency = await claimFinanceIdempotencyKey(client, {
      scope: 'admin.coin_request.review',
      idempotencyKey: getIdempotencyKey(req),
      requestPayload: { id: Number(id), action, rejection_reason: rejection_reason?.trim() || null },
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
      const googerId = await resolveGoogerMainWalletUserId(client);
      if (googerId) {
        await creditWalletAndRecordTransfer(client, {
          senderId: googerId,
          receiverId: row.user_id,
          amount: row.amount,
          note: `Top-up approved - ${row.payment_method_name || 'N/A'}`,
          type: 'topup_approved',
          status: 'accepted',
          commission: 0,
          commissionPercentage: 0,
          creditWallet: true,
        });
      } else {
        await client.query(
          `UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
          [row.amount, row.user_id]
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

    const updated = await client.query(
      `SELECT cr.*, u.username, u.full_name, u.email, u.wallet_balance
       FROM coin_requests cr JOIN users u ON u.id = cr.user_id WHERE cr.id = $1`,
      [id]
    );
    const responseBody = { success: true, data: updated.rows[0] };
    if (idempotency.recordId) {
      await completeFinanceIdempotencyKey(client, idempotency.recordId, responseBody);
    }
    await client.query('COMMIT');
    await audit(req, {
      action: 'admin.coin_request.review',
      status: 'success',
      target: { coinRequestId: Number(id), userId: row.user_id },
      amount: parseFloat(row.amount || 0),
      details: {
        decision: action,
        paymentMethod: row.payment_method_name || null,
        rejectionReason: action === 'reject' ? rejection_reason.trim() : null,
      },
    });
    res.json(responseBody);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    await audit(req, {
      action: 'admin.coin_request.review',
      status: 'error',
      target: { coinRequestId: Number(id) || null },
      details: { decision: action || null },
      error: err.message,
    });
    res.status(500).json({ success: false, message: 'Failed to process request' });
  } finally {
    client.release();
  }
});

module.exports = router;
