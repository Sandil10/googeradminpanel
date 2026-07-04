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

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtcIso = (value) => {
  if (!value) return null;
  const raw = value instanceof Date
    ? value.toISOString()
    : String(value).trim().replace(' ', 'T');
  const parsed = new Date(raw.endsWith('Z') ? raw : `${raw}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getTimestampMs = (value) => {
  const iso = toUtcIso(value);
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const calculateAdDurationState = (row, nowMs = Date.now()) => {
  const durationDays = Number(row?.duration_days || row?.durationDays || 0);
  const totalMs = durationDays > 0 ? durationDays * DAY_MS : 0;
  const status = String(row?.status || '').trim();
  const lastResumedAtMs = getTimestampMs(row?.last_resumed_at || row?.lastResumedAt);
  const accumulatedActiveMs = Math.max(0, Number(row?.accumulated_active_ms ?? row?.accumulatedActiveMs ?? 0) || 0);
  const liveSegmentMs = status === 'Active' && lastResumedAtMs
    ? Math.max(0, nowMs - lastResumedAtMs)
    : 0;
  const elapsedMs = totalMs > 0
    ? Math.min(totalMs, accumulatedActiveMs + liveSegmentMs)
    : 0;
  const remainingMs = totalMs > 0
    ? Math.max(0, totalMs - elapsedMs)
    : 0;

  return { totalMs, elapsedMs, remainingMs, accumulatedActiveMs };
};

const normalizeAdRows = (rows) => rows.map((row) => {
  const status = normalizeAdStatus(row.status) || 'Under Review';
  const durationState = calculateAdDurationState({ ...row, status });
  const countedViews = Number(row.counted_views ?? row.views_count ?? row.viewCount ?? row.views ?? 0);
  const impressions = Number(row.impressions_count ?? row.impressions ?? 0);
  const clicks = Number(row.clicks ?? row.click_events ?? 0);
  const activeStartTime = toUtcIso(row.active_start_time || row.started_at);
  const startedAt = toUtcIso(row.started_at || row.active_start_time);

  return {
    ...row,
    status,
    views: countedViews,
    views_count: countedViews,
    viewCount: countedViews,
    impressions,
    impressions_count: impressions,
    impressionsCount: impressions,
    clicks,
    reach: countedViews,
    reach_count: countedViews,
    currentReach: Number(row.current_reach ?? row.reach ?? countedViews ?? 0),
    current_reach: Number(row.current_reach ?? row.reach ?? countedViews ?? 0),
    activeStartTime,
    active_start_time: activeStartTime,
    startedAt,
    started_at: startedAt,
    pausedAt: toUtcIso(row.paused_at),
    paused_at: toUtcIso(row.paused_at),
    lastResumedAt: toUtcIso(row.last_resumed_at),
    last_resumed_at: toUtcIso(row.last_resumed_at),
    completedAt: toUtcIso(row.completed_at),
    completed_at: toUtcIso(row.completed_at),
    accumulatedActiveMs: durationState.accumulatedActiveMs,
    accumulated_active_ms: durationState.accumulatedActiveMs,
    durationRemainingMs: durationState.remainingMs,
    duration_remaining_ms: durationState.remainingMs,
    durationElapsedMs: durationState.elapsedMs,
    duration_elapsed_ms: durationState.elapsedMs,
    durationTotalMs: durationState.totalMs,
    duration_total_ms: durationState.totalMs,
    createdAt: toUtcIso(row.created_at),
    created_at: toUtcIso(row.created_at),
    updatedAt: toUtcIso(row.updated_at),
    updated_at: toUtcIso(row.updated_at),
  };
});

const APPROVAL_START_CAMPAIGNS = new Set([
  'photo and video',
  'photo & video',
  'photo promote',
  'video promote',
  'product promote',
  'profile promote',
]);

const isApprovalStartCampaign = (ad) => {
  const type = String(ad?.campaign_type || ad?.campaignType || '').trim().toLowerCase();
  return APPROVAL_START_CAMPAIGNS.has(type);
};

const ensureAdsAdminColumns = async () => {
  await pool.query(`
    ALTER TABLE ads
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS rejection_note TEXT,
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS active_start_time TIMESTAMP,
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_resumed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS max_reach_cap INTEGER DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP DEFAULT NULL
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ad_click_events (
      id SERIAL PRIMARY KEY,
      ad_id VARCHAR(80) NOT NULL,
      user_id INTEGER NULL,
      viewer_key TEXT,
      ip_address TEXT,
      action_type VARCHAR(30) NOT NULL DEFAULT 'visit',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const completeAdsAtReachCap = async () => {
  await ensureAdsAdminColumns();
  await pool.query(`
    UPDATE ads a
    SET status = 'Completed',
        completed_at = COALESCE(a.completed_at, CURRENT_TIMESTAMP),
        remaining_budget = CASE
          WHEN LOWER(COALESCE(a.campaign_type, '')) IN ('product promote','photo promote','video promote','photo and video','photo & video','profile promote')
          THEN 0
          ELSE a.remaining_budget
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE LOWER(TRIM(REPLACE(REPLACE(COALESCE(a.status, ''), '_', ' '), '-', ' '))) IN ('active', 'approved')
      AND COALESCE(a.max_reach_cap, 0) > 0
      AND COALESCE(a.impressions, 0) >= a.max_reach_cap
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
    await completeAdsAtReachCap();
    const { status } = req.query;
    let query = `
      SELECT
        a.*,
        COALESCE(av.counted_views, 0) AS counted_views,
        COALESCE(av.unique_reach, 0) AS unique_reach,
        COALESCE(av.counted_views, 0) AS reach_count,
        COALESCE(a.impressions, 0) AS impressions_count,
        COALESCE(a.clicks, click_stats.click_events, 0) AS clicks,
        u.username,
        u.full_name,
        u.user_type,
        u.profile_picture
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN (
        SELECT ad_id,
               COUNT(*)::int AS counted_views,
               COUNT(DISTINCT COALESCE(user_id::text, viewer_key, ip_address, id::text))::int AS unique_reach
        FROM ad_views
        GROUP BY ad_id
      ) av ON av.ad_id::text = a.ad_id::text
      LEFT JOIN (
        SELECT ad_id, COUNT(*) AS click_events
        FROM ad_click_events
        GROUP BY ad_id
      ) click_stats ON click_stats.ad_id::text = a.ad_id::text
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
    await completeAdsAtReachCap();
    const { adId } = req.params;
    const result = await pool.query(
      `
        SELECT
          a.*,
          COALESCE(av.counted_views, 0) AS counted_views,
          COALESCE(av.unique_reach, 0) AS unique_reach,
          COALESCE(av.counted_views, 0) AS reach_count,
          COALESCE(a.impressions, 0) AS impressions_count,
          COALESCE(a.clicks, click_stats.click_events, 0) AS clicks,
          u.username,
          u.full_name,
          u.user_type,
          u.profile_picture
        FROM ads a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN (
          SELECT ad_id,
                 COUNT(*)::int AS counted_views,
                 COUNT(DISTINCT COALESCE(user_id::text, viewer_key, ip_address, id::text))::int AS unique_reach
          FROM ad_views
          GROUP BY ad_id
        ) av ON av.ad_id::text = a.ad_id::text
        LEFT JOIN (
          SELECT ad_id, COUNT(*) AS click_events
          FROM ad_click_events
          GROUP BY ad_id
        ) click_stats ON click_stats.ad_id::text = a.ad_id::text
        WHERE a.ad_id::text = $1::text
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
       WHERE ad_id::text = $1::text
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
    const shouldSetApprovalStartTime = nextStatus === 'Active'
      && (wasPendingApproval || !currentAd.approved_at || !currentAd.active_start_time)
      && isApprovalStartCampaign(currentAd);

    const overrideDuration = nextStatus === 'Active' && durationDays !== undefined && durationDays !== null
      ? Number(durationDays)
      : null;

    const updateParams = [nextStatus, adId, nextRejectionReason, nextRejectionNote, shouldSetApprovalStartTime];
    let updateQuery;
    if (overrideDuration !== null) {
      updateParams.push(overrideDuration);
      updateQuery = `
        UPDATE ads
        SET status = $1::varchar,
            rejection_reason = $3,
            rejection_note = $4,
            rejected_at = CASE WHEN $1::varchar = 'Cancelled' THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE rejected_at END,
            approved_at = CASE WHEN $5 THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE approved_at END,
            active_start_time = CASE WHEN $5 THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE active_start_time END,
            started_at = CASE WHEN $5 THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE started_at END,
            last_resumed_at = CASE WHEN $1::varchar = 'Active' AND status IS DISTINCT FROM 'Active'::varchar THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE last_resumed_at END,
            duration_days = $6::integer,
            updated_at = CURRENT_TIMESTAMP
        WHERE ad_id::text = $2::text
        RETURNING *
      `;
    } else {
      updateQuery = `
        UPDATE ads
        SET status = $1::varchar,
            rejection_reason = $3,
            rejection_note = $4,
            rejected_at = CASE WHEN $1::varchar = 'Cancelled' THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE rejected_at END,
            approved_at = CASE WHEN $5 THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE approved_at END,
            active_start_time = CASE WHEN $5 THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE active_start_time END,
            started_at = CASE WHEN $5 THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE started_at END,
            last_resumed_at = CASE WHEN $1::varchar = 'Active' AND status IS DISTINCT FROM 'Active'::varchar THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE last_resumed_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE ad_id::text = $2::text
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
