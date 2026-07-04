const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// User-facing: submit a product/ad report (auth required, no admin check)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { target_id, target_type, reason } = req.body;
    if (!target_id || !reason) return res.status(400).json({ success: false, message: 'target_id and reason are required' });

    const userId = req.user.id;
    const [rawReason, ...customParts] = String(reason).split(': ');
    const customReason = customParts.join(': ').trim() || null;
    const cleanReason = rawReason === 'Other' && customReason ? 'Other' : rawReason;

    if (target_type === 'goog' || target_type === 'post') {
      // goog_reports: (goog_id, user_id, reason, custom_reason, status)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS goog_reports (
          id SERIAL PRIMARY KEY, goog_id INTEGER REFERENCES goog_posts(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reason VARCHAR(200) NOT NULL, custom_reason TEXT, status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(goog_id, user_id)
        )
      `);
      await pool.query(
        'INSERT INTO goog_reports (goog_id, user_id, reason, custom_reason) VALUES ($1, $2, $3, $4) ON CONFLICT (goog_id, user_id) DO UPDATE SET reason = EXCLUDED.reason, custom_reason = EXCLUDED.custom_reason',
        [target_id, userId, cleanReason, customReason]
      );
    } else {
      // market_reports: products and ads (target_type = "product" or "ad")
      await pool.query(`
        CREATE TABLE IF NOT EXISTS market_reports (
          id SERIAL PRIMARY KEY, market_id INTEGER REFERENCES market(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reason VARCHAR(200) NOT NULL, custom_reason TEXT, status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(market_id, user_id)
        )
      `);
      await pool.query(
        'INSERT INTO market_reports (market_id, user_id, reason, custom_reason) VALUES ($1, $2, $3, $4) ON CONFLICT (market_id, user_id) DO UPDATE SET reason = EXCLUDED.reason, custom_reason = EXCLUDED.custom_reason',
        [target_id, userId, cleanReason, customReason]
      );
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[reports POST]', err.message);
    if (err.message?.includes('already reported') || err.code === '23505') {
      return res.status(409).json({ success: false, message: 'You have already reported this item.' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.use(authMiddleware, adminOnly);

// Ensure all report tables exist on first use
const ensureReportTables = async () => {
  const pool2 = require('../config/database');
  await pool2.query(`CREATE TABLE IF NOT EXISTS goog_comment_reports (
    id SERIAL PRIMARY KEY, comment_id INTEGER REFERENCES goog_comments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(comment_id, user_id)
  )`).catch(()=>{});
  await pool2.query(`CREATE TABLE IF NOT EXISTS market_comment_reports (
    id SERIAL PRIMARY KEY, comment_id INTEGER REFERENCES market_comments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(comment_id, user_id)
  )`).catch(()=>{});
  await pool2.query(`ALTER TABLE market_reports ALTER COLUMN reason TYPE VARCHAR(500)`).catch(()=>{});
  await pool2.query(`CREATE TABLE IF NOT EXISTS market_reports (
    id SERIAL PRIMARY KEY, market_id INTEGER REFERENCES market(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason VARCHAR(500) NOT NULL, custom_reason TEXT, status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(market_id, user_id)
  )`).catch(()=>{});
  await pool2.query(`ALTER TABLE market_comments ADD COLUMN IF NOT EXISTS reports INTEGER DEFAULT 0`).catch(()=>{});
  // Remove overflowed ad_report rows that don't match any real ad (legacy parseInt overflow: real IDs > 1e12)
  await pool2.query(`
    DELETE FROM ad_reports
    WHERE ad_id < 1000000000000
    AND NOT EXISTS (
      SELECT 1 FROM ads a WHERE a.ad_id::text = ad_id::text
    )
  `).catch(()=>{});
};
ensureReportTables();

const safeQuery = async (query, params = []) => {
  try { return (await pool.query(query, params)).rows; } catch (e) { console.error('[reports safeQuery error]', e.message, '\nQuery:', query.slice(0, 200)); return []; }
};

// Goog post reports — goog_posts uses "text" column
router.get('/googs', async (req, res) => {
  const rows = await safeQuery(`
    SELECT gr.id, gr.goog_id, gr.reason, gr.custom_reason, gr.status, gr.created_at,
           gp.text as goog_content,
           ru.id as reporter_db_id, ru.user_id as reporter_user_id,
           ru.username as reporter_username, ru.full_name as reporter_name,
           ru.profile_picture as reporter_profile_picture,
           gu.id as goog_owner_id, gu.user_id as goog_owner_public_id,
           gu.username as goog_owner_username, gu.full_name as goog_owner_name,
           gu.profile_picture as goog_owner_profile_picture
    FROM goog_reports gr
    LEFT JOIN goog_posts gp ON gr.goog_id = gp.id
    LEFT JOIN users ru ON gr.user_id = ru.id
    LEFT JOIN users gu ON gp.user_id = gu.id
    ORDER BY gr.created_at DESC
  `);
  res.json({ reports: rows });
});

// Goog comment reports — uses goog_comment_reports table
router.get('/goog-comments', async (req, res) => {
  const tableCheck = await safeQuery(`
    SELECT 1 FROM information_schema.tables WHERE table_name = 'goog_comment_reports'
  `);
  if (!tableCheck.length) return res.json({ reports: [] });

  const rows = await safeQuery(`
    SELECT gc.id, gc.goog_id, gc.comment as content, gc.reports, gc.created_at,
           MAX(gcr.created_at) as reported_at,
           gc.user_id as commenter_db_id,
           u.user_id as commenter_public_id,
           u.username as commenter_username, u.full_name as commenter_name,
           u.profile_picture as commenter_profile_picture,
           gp.text as goog_content,
           go.user_id as goog_owner_public_id,
           go.username as goog_owner_username,
           go.profile_picture as goog_owner_profile_picture,
           COUNT(gcr.id)::int as report_count,
           (SELECT json_agg(json_build_object(
             'user_id', ru.user_id, 'username', ru.username,
             'full_name', ru.full_name, 'profile_picture', ru.profile_picture
           )) FROM goog_comment_reports gcr2
            LEFT JOIN users ru ON gcr2.user_id = ru.id
            WHERE gcr2.comment_id = gc.id) as reporters
    FROM goog_comments gc
    INNER JOIN goog_comment_reports gcr ON gcr.comment_id = gc.id
    LEFT JOIN users u ON gc.user_id = u.id
    LEFT JOIN goog_posts gp ON gc.goog_id = gp.id
    LEFT JOIN users go ON gp.user_id = go.id
    GROUP BY gc.id, gc.goog_id, gc.comment, gc.reports, gc.created_at, gc.user_id,
             u.user_id, u.username, u.full_name, u.profile_picture,
             gp.text, go.user_id, go.username, go.profile_picture
    ORDER BY report_count DESC, reported_at DESC
  `);
  res.json({ reports: rows });
});

// Order reports
router.get('/orders', async (req, res) => {
  const rows = await safeQuery(`
    SELECT o.id as order_id, o.item_id, o.status, o.report_status, o.report_by,
           o.buyer_report, o.seller_report, o.created_at,
           bu.id as buyer_db_id, bu.user_id as buyer_public_id,
           bu.username as buyer_username, bu.full_name as buyer_name,
           su.id as seller_db_id, su.user_id as seller_public_id,
           su.username as seller_username, su.full_name as seller_name,
           m.title as product_title
    FROM orders o
    LEFT JOIN users bu ON o.buyer_id = bu.id
    LEFT JOIN users su ON o.seller_id = su.id
    LEFT JOIN market m ON o.item_id = m.id
    WHERE o.buyer_report IS NOT NULL OR o.seller_report IS NOT NULL
    ORDER BY o.created_at DESC
  `);
  res.json({ reports: rows });
});

// Product comment reports
router.get('/product-comments', async (req, res) => {
  // Check if market_comment_reports table exists
  const tableCheck = await safeQuery(`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'market_comment_reports'
  `);
  if (!tableCheck.length) return res.json({ reports: [] });

  const rows = await safeQuery(`
    SELECT mc.id, mc.market_id, mc.comment as content, mc.created_at,
           MAX(mcr.created_at) as reported_at,
           mc.user_id as commenter_db_id,
           u.user_id as commenter_public_id,
           u.username as commenter_username, u.full_name as commenter_name,
           u.profile_picture as commenter_profile_picture,
           m.title as product_title, m.user_id as seller_db_id,
           su.user_id as seller_public_id,
           su.username as seller_username,
           su.profile_picture as seller_profile_picture,
           COUNT(mcr.id)::int as reports,
           (SELECT json_agg(json_build_object(
             'user_id', ru.user_id, 'username', ru.username,
             'full_name', ru.full_name, 'profile_picture', ru.profile_picture
           )) FROM market_comment_reports mcr2
            LEFT JOIN users ru ON mcr2.user_id = ru.id
            WHERE mcr2.comment_id = mc.id) as reporters
    FROM market_comments mc
    INNER JOIN market_comment_reports mcr ON mcr.comment_id = mc.id
    LEFT JOIN users u ON mc.user_id = u.id
    LEFT JOIN market m ON mc.market_id = m.id
    LEFT JOIN users su ON m.user_id = su.id
    GROUP BY mc.id, mc.market_id, mc.comment, mc.created_at, mc.user_id,
             u.user_id, u.username, u.full_name, u.profile_picture,
             m.title, m.user_id, su.user_id, su.username, su.profile_picture
    ORDER BY reports DESC, reported_at DESC
  `);
  res.json({ reports: rows });
});

// Profile/user reports
router.get('/profiles', async (req, res) => {
  const rows = await safeQuery(`
    SELECT ur.id, ur.reported_user_id, ur.reporter_id, ur.reason, ur.custom_reason,
           ur.status, ur.created_at,
           ru.user_id as reporter_public_id,
           ru.username as reporter_username, ru.full_name as reporter_name,
           ru.profile_picture as reporter_profile_picture,
           tu.user_id as reported_public_id,
           tu.username as reported_username, tu.full_name as reported_name,
           tu.profile_picture as reported_profile_picture
    FROM user_reports ur
    LEFT JOIN users ru ON ur.reporter_id = ru.id
    LEFT JOIN users tu ON ur.reported_user_id = tu.id
    ORDER BY ur.created_at DESC
  `);
  res.json({ reports: rows });
});

// Ads/product reports — market_reports (shop products) + ad_reports (photo/video/promote ads)
router.get('/ads', async (req, res) => {
  // Debug: log raw market_reports rows and market table count
  const rawCount = await safeQuery(`SELECT COUNT(*) FROM market_reports`);
  const rawRows = await safeQuery(`SELECT id, market_id, user_id FROM market_reports ORDER BY created_at DESC LIMIT 5`);
  const marketCount = await safeQuery(`SELECT COUNT(*) FROM market`);
  console.log('[reports/ads] market_reports count:', rawCount[0]?.count, '| market table count:', marketCount[0]?.count);
  console.log('[reports/ads] recent market_reports rows:', JSON.stringify(rawRows));

  // Market/product reports
  let productRows = await safeQuery(`
    SELECT mr.id, mr.market_id AS target_id, mr.reason, mr.custom_reason,
           COALESCE(mr.status, 'pending') AS status, mr.created_at,
           'product' AS report_type,
           u.id as reporter_db_id, u.user_id as reporter_public_id,
           u.username as reporter_username, u.full_name as reporter_name,
           u.profile_picture as reporter_profile_picture,
           COALESCE(m.title, 'Product #' || mr.market_id::text) as item_title,
           m.status as item_status, m.campaign_type,
           COALESCE(su.id, su2.id) as seller_db_id,
           COALESCE(su.user_id, su2.user_id) as seller_public_id,
           COALESCE(su.username, su2.username, m.username) as seller_username,
           COALESCE(su.full_name, su2.full_name, m.username) as seller_name,
           COALESCE(su.profile_picture, su2.profile_picture) as seller_profile_picture
    FROM market_reports mr
    LEFT JOIN users u ON mr.user_id = u.id
    LEFT JOIN market m ON mr.market_id = m.id
    LEFT JOIN users su ON m.user_id::text = su.id::text
    LEFT JOIN users su2 ON m.username = su2.username
    ORDER BY mr.created_at DESC
  `);
  console.log('[reports/ads] productRows from join:', productRows.length);
  // Fallback: if join returned nothing but raw table has rows, return raw rows
  if (productRows.length === 0 && Number(rawCount[0]?.count) > 0) {
    console.log('[reports/ads] join returned 0 rows but table has data — using raw fallback');
    productRows = await safeQuery(`
      SELECT mr.id, mr.market_id AS target_id, mr.reason, mr.custom_reason,
             COALESCE(mr.status, 'pending') AS status, mr.created_at,
             'product' AS report_type,
             u.id as reporter_db_id, u.user_id as reporter_public_id,
             u.username as reporter_username, u.full_name as reporter_name,
             u.profile_picture as reporter_profile_picture,
             NULL as item_title, NULL as item_status, NULL as campaign_type,
             NULL as seller_db_id, NULL as seller_public_id,
             NULL as seller_username, NULL as seller_name, NULL as seller_profile_picture
      FROM market_reports mr
      LEFT JOIN users u ON mr.user_id = u.id
      ORDER BY mr.created_at DESC
    `);
  }

  // Photo/video/promote ad reports
  const adTableExists = await safeQuery(`SELECT 1 FROM information_schema.tables WHERE table_name = 'ad_reports'`);
  const adRows = adTableExists.length ? await safeQuery(`
    SELECT ar.id, ar.ad_id AS target_id, ar.reason, ar.custom_reason, ar.status, ar.created_at,
           'ad' AS report_type,
           u.id as reporter_db_id, u.user_id as reporter_public_id,
           u.username as reporter_username, u.full_name as reporter_name,
           u.profile_picture as reporter_profile_picture,
           a.title as item_title, a.status as item_status, a.campaign_type,
           au.id as seller_db_id, au.user_id as seller_public_id,
           au.username as seller_username, au.full_name as seller_name,
           au.profile_picture as seller_profile_picture
    FROM ad_reports ar
    LEFT JOIN users u ON ar.user_id = u.id
    LEFT JOIN ads a ON ar.ad_id::text = a.ad_id::text
    LEFT JOIN users au ON a.user_id = au.id
    ORDER BY ar.created_at DESC
  `) : [];

  // Merge and sort by created_at desc
  const all = [...productRows, ...adRows].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  res.json({ reports: all });
});

// Update goog report status
router.patch('/googs/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE goog_reports SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete goog comment
router.delete('/goog-comments/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM goog_comments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete product comment
router.delete('/product-comments/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM market_comments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
