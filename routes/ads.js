const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const ensureAdsAdminColumns = async () => {
  await pool.query(`
    ALTER TABLE ads
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS rejection_note TEXT,
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP
  `);
};

const refundRejectedAd = async (client, ad, rejectionReason) => {
  const userId = Number(ad.user_id || 0);
  const transferId = Number(ad.wallet_transfer_id || 0);
  const refundAmount = Number(ad.remaining_budget || ad.budget || 0);

  if (!userId || !transferId || refundAmount <= 0) {
    return;
  }

  const transferRes = await client.query(
    `SELECT *
     FROM wallet_transfers
     WHERE id = $1
     LIMIT 1`,
    [transferId]
  );

  const transfer = transferRes.rows[0];
  if (!transfer) {
    return;
  }

  const transferStatus = String(transfer.status || '').toLowerCase();
  if (transferStatus === 'cancelled' || transferStatus === 'rejected') {
    return;
  }

  await client.query(
    `UPDATE users
     SET hold_balance = GREATEST(hold_balance - $1, 0),
         wallet_balance = wallet_balance + $1
     WHERE id = $2`,
    [refundAmount, userId]
  );

  await client.query(
    `UPDATE wallet_transfers
     SET status = 'cancelled',
         note = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      transferId,
      `Ad rejected refund: ${rejectionReason || 'Admin rejection'}`
    ]
  );

  await client.query(
    `INSERT INTO wallet_transfers (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage)
     VALUES ($1, $2, $3, $4, 'ad_refund', 'accepted', 0, 0)`,
    [
      userId,
      userId,
      refundAmount,
      `Refund for rejected ad ${ad.ad_id}: ${rejectionReason || 'Admin rejection'}`
    ]
  );
};

router.get('/all', async (req, res) => {
  try {
    await ensureAdsAdminColumns();
    const { status } = req.query;
    let query = `
      SELECT
        a.*,
        u.full_name,
        u.profile_picture
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (status) {
      const statuses = status
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (statuses.length > 0) {
        params.push(statuses);
        conditions.push(`a.status = ANY($${params.length})`);
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY a.created_at DESC, a.id DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/:adId', async (req, res) => {
  try {
    await ensureAdsAdminColumns();
    const { adId } = req.params;
    const result = await pool.query(
      `
        SELECT
          a.*,
          u.full_name,
          u.profile_picture
        FROM ads a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.ad_id = $1
      `,
      [adId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:adId/status', async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureAdsAdminColumns();
    const { adId } = req.params;
    const { status, rejectionReason, rejectionNote } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({ message: 'Status is required' });
    }

    await client.query('BEGIN');

    const currentAdRes = await client.query(
      `SELECT *
       FROM ads
       WHERE ad_id = $1
       LIMIT 1
       FOR UPDATE`,
      [adId]
    );

    if (currentAdRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Ad not found' });
    }

    const currentAd = currentAdRes.rows[0];
    const nextStatus = status === 'Rejected' ? 'Cancelled' : status;
    const shouldRefund = nextStatus === 'Cancelled' && String(currentAd.status || '') !== 'Cancelled';

    if (nextStatus === 'Cancelled' && !String(rejectionReason || '').trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    if (shouldRefund) {
      await refundRejectedAd(client, currentAd, rejectionReason);
    }

    const result = await client.query(
      `
        UPDATE ads
        SET status = $1,
            rejection_reason = CASE WHEN $1 = 'Cancelled' THEN $3 ELSE rejection_reason END,
            rejection_note = CASE WHEN $1 = 'Cancelled' THEN $4 ELSE rejection_note END,
            rejected_at = CASE WHEN $1 = 'Cancelled' THEN CURRENT_TIMESTAMP ELSE rejected_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE ad_id = $2
        RETURNING *
      `,
      [nextStatus, adId, rejectionReason || null, rejectionNote || null]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Ad not found' });
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error(err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
