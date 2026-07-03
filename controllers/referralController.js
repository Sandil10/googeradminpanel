const pool = require('../config/database');

// ─── Table setup ──────────────────────────────────────────────────────────────

async function ensureTable() {
    // Create level-settings table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS referral_level_settings (
            id                       SERIAL PRIMARY KEY,
            level                    INTEGER UNIQUE NOT NULL,
            name                     VARCHAR(80)    NOT NULL,
            commission_percentage    NUMERIC(8,2)   NOT NULL DEFAULT 0,
            ad_commission_percentage NUMERIC(8,2)   NOT NULL DEFAULT 0,
            is_active                BOOLEAN        NOT NULL DEFAULT true,
            sort_order               INTEGER        NOT NULL DEFAULT 0,
            created_at               TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
            updated_at               TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Add ad_commission_percentage if table already existed without it
    try {
        await pool.query(`
            ALTER TABLE referral_level_settings
                ADD COLUMN IF NOT EXISTS ad_commission_percentage NUMERIC(8,2) NOT NULL DEFAULT 0
        `);
    } catch (err) {
        console.warn('ad_commission_percentage column migration:', err.message);
    }

    // Seed default levels only when table is empty
    const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM referral_level_settings'
    );
    if (Number(rows[0].count) === 0) {
        await pool.query(`
            INSERT INTO referral_level_settings (level, name, commission_percentage, ad_commission_percentage, is_active, sort_order)
            VALUES
                (0, 'Googer',    0,  0, true, 0),
                (1, 'Direct',   40,  0, true, 1),
                (2, 'Team',     20,  0, true, 2),
                (3, 'Network',  10,  0, true, 3),
                (4, 'Extended',  5,  0, true, 4),
                (5, 'Global',    3,  0, true, 5)
        `);
    } else {
        // Ensure Googer level exists for existing DBs
        await pool.query(`
            INSERT INTO referral_level_settings (level, name, commission_percentage, ad_commission_percentage, is_active, sort_order)
            VALUES (0, 'Googer', 0, 0, true, 0)
            ON CONFLICT (level) DO NOTHING
        `);
    }

    // Add level + commission_percentage columns to referral_relationships if the
    // table already exists (user-side table). Silently ignored if table is absent.
    try {
        await pool.query(`
            ALTER TABLE referral_relationships
                ADD COLUMN IF NOT EXISTS level                 INTEGER      DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(8,2) DEFAULT 0
        `);
    } catch (err) {
        // Table doesn't exist yet – that's fine, user-side will create it
        if (err.code !== '42P01') {
            console.warn('referral_relationships column migration:', err.message);
        }
    }

    // Commission payouts ledger (written by the payment engine on the user side)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS referral_commission_payouts (
            id                    SERIAL PRIMARY KEY,
            buyer_id              INTEGER,
            earner_id             INTEGER,
            level                 INTEGER,
            source_type           VARCHAR(20)  DEFAULT 'product',
            source_id             INTEGER,
            pool_amount           NUMERIC(12,2) DEFAULT 0,
            commission_percentage NUMERIC(8,2)  DEFAULT 0,
            amount                NUMERIC(12,2) DEFAULT 0,
            wallet_transfer_id    INTEGER,
            created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // Migrate old amount_paid column name → amount (for tables created before this change)
    try {
        await pool.query(`ALTER TABLE referral_commission_payouts RENAME COLUMN amount_paid TO amount`);
    } catch { /* already renamed or column doesn't exist — safe to ignore */ }
    try {
        await pool.query(`ALTER TABLE referral_commission_payouts ADD COLUMN IF NOT EXISTS wallet_transfer_id INTEGER`);
    } catch { /* already exists */ }
}

ensureTable().catch(err =>
    console.error('referral_level_settings init error:', err.message)
);

// ── helpers ───────────────────────────────────────────────────────────────────

async function safeQuery(sql, params, fallback) {
    try {
        const { rows } = await pool.query(sql, params);
        return rows;
    } catch (err) {
        console.warn('safeQuery fallback:', err.message);
        return fallback;
    }
}

// Recompute each user's referral depth and write level + commission_percentage
// back into referral_relationships so the user-side app can read it directly.
async function syncAllCommissions() {
    try {
        const { rows: levels } = await pool.query(
            'SELECT level, commission_percentage FROM referral_level_settings ORDER BY level ASC'
        );
        if (levels.length === 0) return;

        const levelMap = {};
        for (const l of levels) levelMap[l.level] = parseFloat(l.commission_percentage);

        // Compute shallowest depth for every user in referral_relationships
        const computed = await safeQuery(`
            WITH RECURSIVE ref_tree AS (
                SELECT rr.user_id, 1 AS depth
                FROM referral_relationships rr
                WHERE rr.referred_by NOT IN (
                    SELECT DISTINCT user_id FROM referral_relationships
                )
                UNION ALL
                SELECT child.user_id, parent.depth + 1
                FROM referral_relationships child
                JOIN ref_tree parent ON parent.user_id = child.referred_by
                WHERE parent.depth < 20
            )
            SELECT DISTINCT ON (user_id) user_id, depth
            FROM ref_tree
            ORDER BY user_id, depth ASC
        `, [], []);

        if (computed.length === 0) return;

        // Bulk update using a VALUES list to avoid N round-trips
        const cases = computed.map((r, i) => {
            const lvl = r.depth;
            const pct = levelMap[lvl] ?? 0;
            return { user_id: r.user_id, level: lvl, pct };
        });

        // Build a single UPDATE … FROM (VALUES …) statement
        const valueParts = cases.map((c, i) => `($${i * 3 + 1}::int, $${i * 3 + 2}::int, $${i * 3 + 3}::numeric)`).join(', ');
        const params = cases.flatMap(c => [c.user_id, c.level, c.pct]);

        await pool.query(`
            UPDATE referral_relationships AS rr
            SET level                 = v.level,
                commission_percentage = v.pct
            FROM (VALUES ${valueParts}) AS v(user_id, level, pct)
            WHERE rr.user_id = v.user_id
        `, params);

        console.log(`syncAllCommissions: updated ${cases.length} rows`);
    } catch (err) {
        console.error('syncAllCommissions error:', err.message);
    }
}

// ─── GET /api/admin/referrals/settings ───────────────────────────────────────

const getSettings = async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM referral_level_settings ORDER BY sort_order ASC, level ASC'
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getSettings:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch referral settings' });
    }
};

// ─── POST /api/admin/referrals/settings ──────────────────────────────────────

const createLevel = async (req, res) => {
    const { level, name, commission_percentage, ad_commission_percentage, is_active, sort_order } = req.body;
    if (!level || !name) {
        return res.status(400).json({ success: false, message: 'level and name are required' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO referral_level_settings (level, name, commission_percentage, ad_commission_percentage, is_active, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [level, name.trim(), commission_percentage ?? 0, ad_commission_percentage ?? 0, is_active ?? true, sort_order ?? level]
        );
        // Sync new commission % into every affected user row
        syncAllCommissions();
        return res.status(201).json({ success: true, data: rows[0], message: 'Level created' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ success: false, message: `Level ${level} already exists` });
        }
        console.error('createLevel:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to create level' });
    }
};

// ─── PUT /api/admin/referrals/settings/:id ───────────────────────────────────

const updateLevel = async (req, res) => {
    const { id } = req.params;
    const { name, commission_percentage, ad_commission_percentage, is_active, sort_order } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE referral_level_settings
             SET name                       = COALESCE($1, name),
                 commission_percentage      = COALESCE($2, commission_percentage),
                 ad_commission_percentage   = COALESCE($3, ad_commission_percentage),
                 is_active                  = COALESCE($4, is_active),
                 sort_order                 = COALESCE($5, sort_order),
                 updated_at                 = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [name?.trim() ?? null, commission_percentage ?? null, ad_commission_percentage ?? null, is_active ?? null, sort_order ?? null, id]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Level not found' });
        }
        // Sync updated commission % into every affected user row
        syncAllCommissions();
        return res.json({ success: true, data: rows[0], message: 'Level updated' });
    } catch (err) {
        console.error('updateLevel:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to update level' });
    }
};

// ─── DELETE /api/admin/referrals/settings/:id ────────────────────────────────

const deleteLevel = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: check } = await pool.query(
            'SELECT id, level FROM referral_level_settings WHERE id = $1', [id]
        );
        if (!check.length) {
            return res.status(404).json({ success: false, message: 'Level not found' });
        }
        if (Number(check[0].level) === 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete the Googer level' });
        }
        const { rows: cnt } = await pool.query(
            'SELECT COUNT(*)::int AS count FROM referral_level_settings'
        );
        if (Number(cnt[0].count) <= 1) {
            return res.status(400).json({ success: false, message: 'Cannot delete the last referral level' });
        }
        await pool.query('DELETE FROM referral_level_settings WHERE id = $1', [id]);
        // Re-sync after level removed (some users may shift depth)
        syncAllCommissions();
        return res.json({ success: true, message: 'Level deleted' });
    } catch (err) {
        console.error('deleteLevel:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to delete level' });
    }
};

// ─── GET /api/admin/referrals/stats ──────────────────────────────────────────

const getStats = async (req, res) => {
    try {
        const [usersRes, referralsRes, commissionRes, pendingRes, googerCommRes] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM users
                 WHERE marked_for_deletion_at IS NULL`
            ),
            safeQuery(
                `SELECT COUNT(*)::int AS count FROM referral_relationships`,
                [], [{ count: 0 }]
            ),
            safeQuery(
                `SELECT COALESCE(SUM(amount), 0)::numeric AS total
                 FROM referral_commission_payouts
                 WHERE level > 0
                   AND level <> 99`,
                [], [{ total: 0 }]
            ),
            safeQuery(
                `SELECT COUNT(*)::int AS count
                 FROM withdrawal_requests
                 WHERE status = 'pending'`,
                [], [{ count: 0 }]
            ),
            safeQuery(
                `SELECT COALESCE(SUM(amount), 0)::numeric AS total
                 FROM referral_commission_payouts WHERE level = 0`,
                [], [{ total: 0 }]
            ),
        ]);

        return res.json({
            success: true,
            data: {
                total_users:              usersRes.rows[0].count,
                total_referrals:          referralsRes[0].count,
                total_commission:         parseFloat(commissionRes[0].total || 0),
                pending_withdrawals:      pendingRes[0].count,
                googer_commission_earned: parseFloat(googerCommRes[0].total || 0),
            },
        });
    } catch (err) {
        console.error('getStats:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
};

// ─── GET /api/admin/referrals/mapping ────────────────────────────────────────

const getMapping = async (req, res) => {
    try {
        const { rows: levels } = await pool.query(
            'SELECT id, level, name FROM referral_level_settings ORDER BY sort_order ASC, level ASC'
        );

        // Compute display depth live so stale stored rr.level values do not hide users.
        const mappingRows = await safeQuery(`
            WITH RECURSIVE referral_tree AS (
                SELECT
                    rr.user_id,
                    rr.referred_by,
                    rr.referral_code_used,
                    rr.created_at,
                    1 AS depth
                FROM referral_relationships rr
                WHERE rr.referred_by NOT IN (
                    SELECT DISTINCT user_id FROM referral_relationships
                )
                UNION ALL
                SELECT
                    child.user_id,
                    child.referred_by,
                    child.referral_code_used,
                    child.created_at,
                    parent.depth + 1
                FROM referral_relationships child
                JOIN referral_tree parent ON parent.user_id = child.referred_by
                WHERE parent.depth < 20
            ),
            shallowest_tree AS (
                SELECT DISTINCT ON (user_id)
                    user_id,
                    referred_by,
                    referral_code_used,
                    created_at,
                    depth
                FROM referral_tree
                ORDER BY user_id, depth ASC
            ),
            display_tree AS (
                SELECT
                    user_id,
                    referred_by,
                    referral_code_used,
                    created_at,
                    depth
                FROM shallowest_tree
                UNION ALL
                SELECT
                    rr.user_id,
                    rr.referred_by,
                    rr.referral_code_used,
                    rr.created_at,
                    COALESCE(NULLIF(rr.level, 0), 1) AS depth
                FROM referral_relationships rr
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM shallowest_tree st
                    WHERE st.user_id = rr.user_id
                )
            )
            SELECT
                st.user_id,
                st.referred_by,
                st.depth,
                st.referral_code_used,
                st.created_at     AS referral_date,
                u.id,
                u.username,
                u.full_name,
                u.user_id         AS user_code,
                u.profile_picture,
                u.created_at      AS registered_at,
                COALESCE(cp.total_commission, 0)::numeric AS total_commission,
                ref.username      AS referred_by_username,
                ref.full_name     AS referred_by_full_name
            FROM display_tree st
            JOIN users u   ON u.id = st.user_id
            LEFT JOIN users ref ON ref.id = st.referred_by
            LEFT JOIN (
                SELECT earner_id, SUM(amount) AS total_commission
                FROM referral_commission_payouts
                GROUP BY earner_id
            ) cp ON cp.earner_id = u.id
            WHERE u.marked_for_deletion_at IS NULL
            ORDER BY st.depth ASC, u.full_name ASC
        `, [], []);

        const depthMap = {};
        for (const row of mappingRows) {
            const d = row.depth;
            if (!depthMap[d]) depthMap[d] = [];
            depthMap[d].push({
                id:                    row.id,
                username:              row.username,
                full_name:             row.full_name,
                user_code:             row.user_code,
                profile_picture:       row.profile_picture,
                referred_by:           row.referred_by,
                referred_by_username:  row.referred_by_username,
                referred_by_full_name: row.referred_by_full_name,
                referral_code_used:    row.referral_code_used,
                referral_date:         row.referral_date,
                registered_at:         row.registered_at,
                total_commission:      parseFloat(row.total_commission || 0),
            });
        }

        const result = levels.map(l => ({
            level:         l.level,
            level_name:    l.name,
            is_admin_only: l.level === 0,
            users:         l.level === 0 ? [] : (depthMap[l.level] || []),
        }));

        return res.json({ success: true, data: result });
    } catch (err) {
        console.error('getMapping:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch referral mapping' });
    }
};

// ─── GET /api/admin/referrals/top-earners ────────────────────────────────────

const getTopEarners = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
        const rows = await safeQuery(`
            SELECT
                u.id,
                u.username,
                u.full_name,
                u.user_id            AS user_code,
                u.profile_picture,
                COALESCE(rc.referral_count, 0)::int AS referral_count,
                COALESCE(cp.total_earned, 0)::numeric AS total_earned
            FROM users u
            JOIN (
                SELECT earner_id, SUM(amount) AS total_earned
                FROM referral_commission_payouts
                WHERE level > 0
                  AND level <> 99
                GROUP BY earner_id
            ) cp ON cp.earner_id = u.id
            LEFT JOIN (
                SELECT referred_by, COUNT(*) AS referral_count
                FROM referral_relationships
                GROUP BY referred_by
            ) rc ON rc.referred_by = u.id
            WHERE u.marked_for_deletion_at IS NULL
            ORDER BY total_earned DESC, referral_count DESC, u.full_name ASC
            LIMIT $1
        `, [limit], []);

        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getTopEarners:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch top earners' });
    }
};

// ─── GET /api/admin/referrals/top-referrers ──────────────────────────────────

const getTopReferrers = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
        const rows = await safeQuery(`
            SELECT
                u.id,
                u.username,
                u.full_name,
                u.user_id            AS user_code,
                u.profile_picture,
                COUNT(rr.id)::int    AS referral_count,
                COALESCE(cp.total_earned, 0)::numeric AS total_earned
            FROM users u
            JOIN referral_relationships rr ON rr.referred_by = u.id
            LEFT JOIN (
                SELECT earner_id, SUM(amount) AS total_earned
                FROM referral_commission_payouts
                WHERE level > 0
                  AND level <> 99
                GROUP BY earner_id
            ) cp ON cp.earner_id = u.id
            WHERE u.marked_for_deletion_at IS NULL
            GROUP BY u.id, u.username, u.full_name, u.user_id, u.profile_picture, cp.total_earned
            ORDER BY referral_count DESC, total_earned DESC, u.full_name ASC
            LIMIT $1
        `, [limit], []);

        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getTopReferrers:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch top referrers' });
    }
};

// ─── GET /api/admin/referrals/buyer-line/:userId ──────────────────────────────

const getBuyerLine = async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (!userId) return res.status(400).json({ success: false, message: 'Invalid userId' });

    try {
        const { rows: buyerRows } = await pool.query(
            `SELECT id, username, full_name, user_id AS user_code, profile_picture, created_at AS registered_at
             FROM users WHERE id = $1`,
            [userId]
        );
        if (!buyerRows.length) return res.status(404).json({ success: false, message: 'User not found' });

        const upline = await safeQuery(`
            WITH RECURSIVE up AS (
                SELECT rr.user_id, rr.referred_by, 1 AS depth
                FROM referral_relationships rr
                WHERE rr.user_id = $1
                UNION ALL
                SELECT rr.user_id, rr.referred_by, up.depth + 1
                FROM referral_relationships rr
                JOIN up ON rr.user_id = up.referred_by
                WHERE up.depth < 20
            )
            SELECT
                up.depth,
                u2.id, u2.username, u2.full_name, u2.user_id AS user_code, u2.profile_picture,
                rls.commission_percentage, rls.ad_commission_percentage, rls.name AS level_name, rls.is_active
            FROM up
            JOIN users u2 ON u2.id = up.referred_by
            LEFT JOIN referral_level_settings rls ON rls.level = up.depth
            WHERE u2.marked_for_deletion_at IS NULL
            ORDER BY up.depth ASC
        `, [userId], []);

        return res.json({ success: true, data: { buyer: buyerRows[0], upline } });
    } catch (err) {
        console.error('getBuyerLine:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch buyer line' });
    }
};

// ─── GET /api/admin/referrals/commission-preview ──────────────────────────────

const getCommissionPreview = async (req, res) => {
    const { buyerId, type, amount } = req.query;
    const amountNum = parseFloat(amount);

    if (!buyerId || !type || isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ success: false, message: 'buyerId, type and a positive amount are required' });
    }

    try {
        const { rows: buyerRows } = await pool.query(
            'SELECT id, username, full_name, user_id AS user_code FROM users WHERE id = $1',
            [parseInt(buyerId)]
        );
        if (!buyerRows.length) return res.status(404).json({ success: false, message: 'Buyer not found' });

        const { rows: poolRows } = await pool.query(
            'SELECT * FROM referral_commission_settings ORDER BY id ASC LIMIT 1'
        );
        const poolPct = type === 'ad'
            ? parseFloat(poolRows[0]?.ad_purchase_pool_percentage || 20)
            : parseFloat(poolRows[0]?.product_purchase_pool_percentage || 20);
        const poolAmount = (amountNum * poolPct) / 100;

        const { rows: activeLevels } = await pool.query(
            `SELECT level, name, commission_percentage, ad_commission_percentage
             FROM referral_level_settings WHERE is_active = true ORDER BY level ASC`
        );
        const levelMap = {};
        for (const l of activeLevels) levelMap[l.level] = l;

        const upline = await safeQuery(`
            WITH RECURSIVE up AS (
                SELECT rr.user_id, rr.referred_by, 1 AS depth
                FROM referral_relationships rr
                WHERE rr.user_id = $1
                UNION ALL
                SELECT rr.user_id, rr.referred_by, up.depth + 1
                FROM referral_relationships rr
                JOIN up ON rr.user_id = up.referred_by
                WHERE up.depth < 20
            )
            SELECT up.depth, u2.id, u2.username, u2.full_name, u2.user_id AS user_code, u2.profile_picture
            FROM up
            JOIN users u2 ON u2.id = up.referred_by
            WHERE u2.marked_for_deletion_at IS NULL
            ORDER BY up.depth ASC
        `, [parseInt(buyerId)], []);

        // Googer (level 0) always receives commission first, regardless of referral upline
        const distribution = [];
        const googerLvl = activeLevels.find(l => parseInt(l.level) === 0);
        if (googerLvl) {
            const googerPct = parseFloat(type === 'ad' ? googerLvl.ad_commission_percentage : googerLvl.commission_percentage);
            distribution.push({
                depth:                0,
                level_name:           googerLvl.name || 'Googer',
                user:                 null,
                is_root:              true,
                commission_percentage: googerPct,
                amount_earned:        parseFloat(((poolAmount * googerPct) / 100).toFixed(2)),
            });
        }

        // Then each upline user at depth 1, 2, 3 ...
        upline.forEach(u => {
            const lvl = levelMap[u.depth];
            const pct = lvl
                ? parseFloat(type === 'ad' ? lvl.ad_commission_percentage : lvl.commission_percentage)
                : 0;
            distribution.push({
                depth:                u.depth,
                level_name:           lvl?.name || `Level ${u.depth}`,
                user: { id: u.id, username: u.username, full_name: u.full_name, user_code: u.user_code, profile_picture: u.profile_picture },
                is_root:              false,
                commission_percentage: pct,
                amount_earned:        parseFloat(((poolAmount * pct) / 100).toFixed(2)),
            });
        });

        return res.json({
            success: true,
            data: {
                buyer:            buyerRows[0],
                transaction_type: type,
                amount:           amountNum,
                pool_percentage:  poolPct,
                pool_amount:      parseFloat(poolAmount.toFixed(2)),
                distribution,
            },
        });
    } catch (err) {
        console.error('getCommissionPreview:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to calculate preview' });
    }
};

// ─── GET /api/admin/referrals/commission-payouts ──────────────────────────────

const getCommissionPayouts = async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
        safeQuery(`
            SELECT
                cp.id, cp.source_type, cp.source_id, cp.pool_amount,
                cp.commission_percentage, cp.amount AS amount_paid, cp.level, cp.created_at,
                buyer.id AS buyer_id, buyer.username AS buyer_username, buyer.full_name AS buyer_full_name,
                earner.id AS earner_id, earner.username AS earner_username, earner.full_name AS earner_full_name
            FROM referral_commission_payouts cp
            LEFT JOIN users buyer  ON buyer.id  = cp.buyer_id
            LEFT JOIN users earner ON earner.id = cp.earner_id
            ORDER BY cp.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset], []),
        safeQuery('SELECT COUNT(*)::int AS total FROM referral_commission_payouts', [], [{ total: 0 }]),
    ]);

    return res.json({ success: true, data: rows, total: countRows[0]?.total || 0, page, limit });
};

module.exports = {
    getSettings,
    createLevel,
    updateLevel,
    deleteLevel,
    getStats,
    getMapping,
    getTopEarners,
    getTopReferrers,
    getBuyerLine,
    getCommissionPreview,
    getCommissionPayouts,
};
