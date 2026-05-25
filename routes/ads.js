const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const adCoinController = require('../controllers/adCoinController');

const VALID_AD_STATUSES = new Set(['Under Review', 'Active', 'Paused', 'Cancelled', 'Completed']);

const normalizeAdStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase().replace(/[_-]+/g, ' ');

  if (normalized === 'approved' || normalized === 'active') return 'Active';
  if (normalized === 'paused' || normalized === 'pause') return 'Paused';
  if (normalized === 'completed' || normalized === 'complete' || normalized === 'expired') return 'Completed';
  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'rejected' || normalized === 'removed' || normalized === 'deleted') return 'Cancelled';
  if (normalized === 'under review' || normalized === 'pending' || normalized === 'pending approval' || normalized === 'review') return 'Under Review';

  return null;
};

const normalizeAdRows = (rows) => rows.map((row) => ({
  ...row,
  status: normalizeAdStatus(row.status) || 'Under Review',
}));

const ensureAdsAdminColumns = async () => {
  await pool.query(`
    ALTER TABLE ads
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS rejection_note TEXT,
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
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

router.get('/all', authMiddleware, adminOnly, async (req, res) => {
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
        .map((value) => normalizeAdStatus(value) || value.trim())
        .filter(Boolean);

      if (statuses.length > 0) {
        params.push(statuses);
        conditions.push(`
          CASE
            WHEN lower(trim(replace(replace(a.status, '_', ' '), '-', ' '))) IN ('approved', 'active') THEN 'Active'
            WHEN lower(trim(replace(replace(a.status, '_', ' '), '-', ' '))) IN ('paused', 'pause') THEN 'Paused'
            WHEN lower(trim(replace(replace(a.status, '_', ' '), '-', ' '))) IN ('completed', 'complete', 'expired') THEN 'Completed'
            WHEN lower(trim(replace(replace(a.status, '_', ' '), '-', ' '))) IN ('cancelled', 'canceled', 'rejected', 'removed', 'deleted') THEN 'Cancelled'
            WHEN lower(trim(replace(replace(a.status, '_', ' '), '-', ' '))) IN ('under review', 'pending', 'pending approval', 'review') THEN 'Under Review'
            ELSE a.status
          END = ANY($${params.length})
        `);
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY a.created_at DESC, a.id DESC';

    const result = await pool.query(query, params);
    res.json(normalizeAdRows(result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/:adId', authMiddleware, adminOnly, async (req, res) => {
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

    res.json(normalizeAdRows(result.rows)[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:adId/status', authMiddleware, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureAdsAdminColumns();
    const { adId } = req.params;
    const { status, rejectionReason, rejectionNote, durationDays } = req.body;

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

    const currentAd = {
      ...currentAdRes.rows[0],
      status: normalizeAdStatus(currentAdRes.rows[0].status) || currentAdRes.rows[0].status,
    };
    const nextStatus = normalizeAdStatus(status);

    if (!VALID_AD_STATUSES.has(nextStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid ad status' });
    }

    const shouldRefund = nextStatus === 'Cancelled' && String(currentAd.status || '') !== 'Cancelled';
    const wasPendingApproval = normalizeAdStatus(currentAd.status) === 'Under Review';

    if (nextStatus === 'Cancelled' && !String(rejectionReason || '').trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    if (shouldRefund) {
      await refundRejectedAd(client, currentAd, rejectionReason);
    }

    const nextRejectionReason = nextStatus === 'Cancelled'
      ? (rejectionReason || currentAd.rejection_reason || null)
      : currentAd.rejection_reason;
    const nextRejectionNote = nextStatus === 'Cancelled'
      ? (rejectionNote || currentAd.rejection_note || null)
      : currentAd.rejection_note;
    const nextRejectedAt = nextStatus === 'Cancelled'
      ? new Date()
      : currentAd.rejected_at;
    const nextApprovedAt = nextStatus === 'Active'
      ? (wasPendingApproval || !currentAd.approved_at ? new Date() : currentAd.approved_at)
      : currentAd.approved_at;

    const overrideDuration = nextStatus === 'Active' && durationDays !== undefined && durationDays !== null
      ? Number(durationDays)
      : null;

    const updateParams = [nextStatus, adId, nextRejectionReason, nextRejectionNote, nextRejectedAt, nextApprovedAt];
    let updateQuery;
    if (overrideDuration !== null) {
      updateParams.push(overrideDuration);
      updateQuery = `
        UPDATE ads
        SET status = $1,
            rejection_reason = $3,
            rejection_note = $4,
            rejected_at = $5,
            approved_at = $6,
            duration_days = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE ad_id = $2
        RETURNING *
      `;
    } else {
      updateQuery = `
        UPDATE ads
        SET status = $1,
            rejection_reason = $3,
            rejection_note = $4,
            rejected_at = $5,
            approved_at = $6,
            updated_at = CURRENT_TIMESTAMP
        WHERE ad_id = $2
        RETURNING *
      `;
    }

    const result = await client.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Ad not found' });
    }

    await client.query('COMMIT');
    res.json(normalizeAdRows(result.rows)[0]);
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

router.post('/:adId/collect-coin', authMiddleware, adCoinController.collectCoin);
router.post('/:adId/like', authMiddleware, adCoinController.likeCoin);

module.exports = router;
