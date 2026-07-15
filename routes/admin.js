const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const os = require('os');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { ListObjectsV2Command, S3Client } = require('@aws-sdk/client-s3');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const { writeAdminAuditEvent } = require('../utils/adminAuditLogger');
const {
    getLockedGoogerPooledState,
    normalizeMoney,
    resolveGoogerMainWalletUserId,
} = require('../../shared/utils/financeBoundary');
const { creditAdminWalletFromGoogerPool } = require('../../shared/utils/financeCommands');
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

function trafficNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function trafficRound(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round(trafficNumber(value) * factor) / factor;
}

function trafficPercent(part, total) {
    const denominator = trafficNumber(total);
    if (denominator <= 0) return 0;
    return trafficRound((trafficNumber(part) / denominator) * 100);
}

function trafficClamp(value, min, max) {
    return Math.min(max, Math.max(min, trafficNumber(value)));
}

function detectTrafficTopology() {
    const hasRemoteDb = Boolean(process.env.DB_HOST && !/localhost|127\.0\.0\.1/i.test(String(process.env.DB_HOST)));
    const hasRedis = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
    const hasObjectStorage = Boolean(process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.STORAGE_BUCKET);
    if (hasRemoteDb || hasRedis || hasObjectStorage) return 'split-services';
    return 'single-server';
}

function detectHostingEnvironment() {
    if (process.env.AWS_EXECUTION_ENV || process.env.EC2_HOME || process.env.AWS_REGION) return 'AWS / EC2';
    if (process.env.DOCKER_CONTAINER || fs.existsSync('/.dockerenv')) return 'Docker host';
    return `${os.platform()} server`;
}

function getDiskSnapshot(targetPath) {
    try {
        if (typeof fs.statfsSync !== 'function') {
            return { totalBytes: null, freeBytes: null, usedBytes: null, usagePercent: null };
        }
        const stats = fs.statfsSync(targetPath);
        const blockSize = trafficNumber(stats.bsize || stats.frsize);
        const totalBytes = blockSize * trafficNumber(stats.blocks);
        const freeBytes = blockSize * trafficNumber(stats.bavail || stats.bfree);
        const usedBytes = Math.max(0, totalBytes - freeBytes);
        return {
            totalBytes,
            freeBytes,
            usedBytes,
            usagePercent: trafficPercent(usedBytes, totalBytes),
        };
    } catch {
        return { totalBytes: null, freeBytes: null, usedBytes: null, usagePercent: null };
    }
}

async function getDirectorySize(targetPath, depth = 0) {
    try {
        const stat = await fsp.stat(targetPath);
        if (!stat.isDirectory()) return stat.size;
        if (depth > 4) return 0;
        const entries = await fsp.readdir(targetPath, { withFileTypes: true });
        const sizes = await Promise.all(entries.slice(0, 250).map(async (entry) => {
            const nextPath = path.join(targetPath, entry.name);
            if (entry.isDirectory()) return getDirectorySize(nextPath, depth + 1);
            if (!entry.isFile()) return 0;
            try {
                return (await fsp.stat(nextPath)).size;
            } catch {
                return 0;
            }
        }));
        return sizes.reduce((sum, size) => sum + trafficNumber(size), 0);
    } catch {
        return 0;
    }
}

let objectStorageSnapshotCache = { expiresAt: 0, value: null };

async function getObjectStorageSnapshot() {
    const bucket = String(process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.STORAGE_BUCKET || '').trim();
    if (!bucket) {
        return { configured: false, available: false, bucket: null, sizeBytes: null, objectCount: null };
    }

    if (objectStorageSnapshotCache.value && objectStorageSnapshotCache.expiresAt > Date.now()) {
        return objectStorageSnapshotCache.value;
    }

    const region = String(process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-1').trim();
    const client = new S3Client({ region });
    let continuationToken;
    let sizeBytes = 0;
    let objectCount = 0;

    try {
        do {
            const page = await client.send(new ListObjectsV2Command({
                Bucket: bucket,
                ContinuationToken: continuationToken,
            }));
            for (const object of page.Contents || []) {
                sizeBytes += trafficNumber(object.Size);
                objectCount += 1;
            }
            continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (continuationToken);

        const value = { configured: true, available: true, bucket, region, sizeBytes, objectCount };
        objectStorageSnapshotCache = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
        return value;
    } catch (error) {
        console.warn('[traffic-analysis] S3 usage lookup failed:', error?.name || error?.message || error);
        return {
            configured: true,
            available: false,
            bucket,
            region,
            sizeBytes: null,
            objectCount: null,
            error: error?.name || 'S3 usage unavailable',
        };
    } finally {
        client.destroy();
    }
}

async function getNetworkTrafficSnapshot() {
    if (process.platform !== 'linux') return { rxBytes: null, txBytes: null };
    try {
        const raw = await fsp.readFile('/proc/net/dev', 'utf8');
        let rxBytes = 0;
        let txBytes = 0;
        raw.split('\n').slice(2).forEach((line) => {
            const [ifacePart, dataPart] = line.trim().split(':');
            const iface = String(ifacePart || '').trim();
            if (!iface || iface === 'lo') return;
            const fields = String(dataPart || '').trim().split(/\s+/);
            rxBytes += trafficNumber(fields[0]);
            txBytes += trafficNumber(fields[8]);
        });
        return { rxBytes, txBytes };
    } catch {
        return { rxBytes: null, txBytes: null };
    }
}

async function tableExists(tableName) {
    try {
        const result = await pool.query('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
        return Boolean(result.rows[0]?.table_name);
    } catch {
        return false;
    }
}

router.get('/stats', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        const client = await pool.connect();
        let statsResult;
        try {
            const googerMainUserId = await resolveGoogerMainWalletUserId(client);
            const [hasUploadPurchases, hasUploadSubscriptions] = await Promise.all([
                tableExists('upload_content_purchases'),
                tableExists('upload_content_subscriptions'),
            ]);
            const uploadPurchaseCommissionSql = hasUploadPurchases
                ? '(SELECT SUM(commission_amount) FROM upload_content_purchases)'
                : '0';
            const uploadSubscriptionCommissionSql = hasUploadSubscriptions
                ? '(SELECT SUM(commission_amount) FROM upload_content_subscriptions)'
                : '0';
            statsResult = await client.query(`
            WITH commission_totals AS (
                SELECT
                    COALESCE((
                        SELECT SUM(commission)
                        FROM wallet_transfers
                        WHERE LOWER(TRIM(COALESCE(status, ''))) = 'accepted'
                    ), 0)::numeric AS wallet_commission,
                    COALESCE((
                        SELECT SUM(commission)
                        FROM wallet_transfers
                        WHERE LOWER(TRIM(COALESCE(status, ''))) = 'accepted'
                          AND LOWER(TRIM(COALESCE(type, ''))) = 'commission_hold'
                    ), 0)::numeric AS upload_transfer_commission,
                    (
                        COALESCE(${uploadPurchaseCommissionSql}, 0)
                        + COALESCE(${uploadSubscriptionCommissionSql}, 0)
                    )::numeric AS upload_record_commission
            ),
            commission_pool AS (
                SELECT
                    (
                        wallet_commission
                        + GREATEST(0, upload_record_commission - upload_transfer_commission)
                    )::numeric AS googer_commission_pool
                FROM commission_totals
            )
            SELECT
                (SELECT COUNT(*)::bigint FROM users) AS total_users,
                (SELECT COUNT(*)::bigint FROM users WHERE LOWER(user_type) = 'seller') AS active_sellers,
                (SELECT COUNT(*)::bigint FROM market WHERE status IN ('pending', 'reviewing')) AS pending_products,
                (
                    SELECT COALESCE(SUM(wallet_balance), 0)
                    FROM users
                    WHERE id <> $1
                      AND LOWER(COALESCE(username, '')) <> 'superadmin'
                      AND marked_for_deletion_at IS NULL
                      AND COALESCE(is_deactivated, false) = false
                      AND LOWER(COALESCE(status, 'active')) <> 'deactivated'
                ) AS total_users_balance,
                (SELECT googer_commission_pool FROM commission_pool) AS googer_balance,
                (SELECT COALESCE(SUM(commission), 0) FROM ad_coin_collections) AS coin_collect_balance,
                (SELECT COALESCE(SUM(commission), 0) FROM wallet_transfers WHERE status = 'accepted' AND type = 'profile_promote') AS ad_publish_balance,
                (SELECT COALESCE(SUM(commission), 0) FROM wallet_transfers WHERE type = 'system_topup' AND status = 'accepted') AS capital_transfer_balance
        `, [googerMainUserId || 0]);
        } finally {
            client.release();
        }
        const stats = statsResult.rows[0] || {};

        return res.json({
            totalUsers: stats.total_users || 0,
            activeSellers: stats.active_sellers || 0,
            pendingProducts: stats.pending_products || 0,
            totalUsersBalance: stats.total_users_balance || 0,
            googerBalance: stats.googer_balance || 0,
            coinCollectBalance: parseFloat(stats.coin_collect_balance || 0),
            adPublishBalance: parseFloat(stats.ad_publish_balance || 0),
            capitalTransferBalance: parseFloat(stats.capital_transfer_balance || 0),
        });

        const [usersCount, sellersCount, pendingProducts, totalBalance, commissions, coinCollect, adPublish, capital] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM users'),
            pool.query("SELECT COUNT(*) FROM users WHERE LOWER(user_type) = 'seller'"),
            pool.query("SELECT COUNT(*) FROM market WHERE status IN ('pending', 'reviewing')"),
            pool.query('SELECT SUM(wallet_balance) FROM users'),
            pool.query("SELECT COALESCE(SUM(commission), 0) AS sum FROM wallet_transfers WHERE status = 'accepted'"),
            // Coin collect commissions come from ad_coin_collections â€” the authoritative source
            pool.query("SELECT COALESCE(SUM(commission), 0) AS sum FROM ad_coin_collections"),
            // Profile promote ad payments stored in wallet_transfers with type = 'profile_promote'
            pool.query("SELECT COALESCE(SUM(commission), 0) AS sum FROM wallet_transfers WHERE status = 'accepted' AND type = 'profile_promote'"),
            // Capital-to-Googer transfers (system_topup), stored in commission column
            pool.query("SELECT COALESCE(SUM(commission), 0) AS sum FROM wallet_transfers WHERE type = 'system_topup' AND status = 'accepted'"),
        ]);

        const coinCollectBalance = parseFloat(coinCollect.rows[0].sum || 0);
        const adPublishBalance = parseFloat(adPublish.rows[0].sum || 0);
        const capitalTransferBalance = parseFloat(capital.rows[0].sum || 0);

        res.json({
            totalUsers: usersCount.rows[0].count,
            activeSellers: sellersCount.rows[0].count,
            pendingProducts: pendingProducts.rows[0].count,
            totalUsersBalance: totalBalance.rows[0].sum || 0,
            googerBalance: commissions.rows[0].sum || 0,
            coinCollectBalance,
            adPublishBalance,
            capitalTransferBalance,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Recent activity feed for the dashboard
router.get('/recent-activity', async (req, res) => {
    try {
        const transfers = await pool.query(`
            SELECT 
                t.id, t.type, t.amount, t.status, t.note, t.created_at,
                u.username as sender_username, u.full_name as sender_name
            FROM wallet_transfers t
            LEFT JOIN users u ON t.sender_id = u.id
            ORDER BY t.created_at DESC
            LIMIT 8
        `);

        const products = await pool.query(`
            SELECT 
                m.id, m.title, m.status, m.created_at,
                COALESCE(u.username, m.username) as seller_username,
                COALESCE(u.full_name, m.username) as seller_name
            FROM market m
            LEFT JOIN users u ON m.user_id = u.id
            ORDER BY m.created_at DESC
            LIMIT 8
        `);

        // Merge and sort by created_at
        const activity = [
            ...transfers.rows.map(r => ({
                id: `t-${r.id}`,
                kind: r.type === 'request' ? 'Top-up Request' : r.type === 'sell' ? 'Sale Transaction' : 'Wallet Transfer',
                user: r.sender_name || r.sender_username || 'Unknown',
                detail: `R ${parseFloat(r.amount || 0).toFixed(2)}`,
                status: r.status,
                created_at: r.created_at,
            })),
            ...products.rows.map(r => ({
                id: `p-${r.id}`,
                kind: r.status === 'reviewing' ? 'Product Review' : r.status === 'active' ? 'Product Listed' : 'Product Update',
                user: r.seller_name || r.seller_username || 'Unknown',
                detail: r.title,
                status: r.status,
                created_at: r.created_at,
            })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
         .slice(0, 6);

        res.json(activity);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});


// Coin collect detail â€” which ads generated Googer coin income
router.get('/coin-collect-detail', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                acc.ad_id,
                acc.ad_type,
                acc.commission,
                acc.reward_amount,
                acc.advertiser_charge,
                acc.created_at,
                a.user_id    AS advertiser_id,
                a.full_name  AS advertiser_name,
                c.user_id    AS collector_user_id,
                c.full_name  AS collector_name
            FROM ad_coin_collections acc
            LEFT JOIN ads ad ON acc.ad_id = ad.ad_id
            LEFT JOIN users a ON ad.user_id = a.id
            LEFT JOIN users c ON acc.user_id = c.id
            ORDER BY acc.created_at DESC
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Profile promote ad payments detail
router.get('/profile-promote-detail', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                wt.id,
                wt.amount,
                wt.commission,
                wt.note,
                wt.status,
                wt.created_at,
                a.ad_id,
                COALESCE(owner.full_name, u.full_name) AS user_name,
                COALESCE(owner.user_id, u.user_id) AS user_readable_id,
                COALESCE(owner.username, u.username) AS username,
                CASE
                    WHEN wt.type = 'ad_refund' OR wt.note ILIKE 'Ad Refund - %' THEN 'refund'
                    ELSE 'credit'
                END AS event_type,
                CASE
                    WHEN wt.type = 'ad_refund' OR wt.note ILIKE 'Ad Refund - %'
                        THEN -ABS(COALESCE(wt.amount, 0))
                    ELSE ABS(COALESCE(NULLIF(wt.commission, 0), wt.amount, 0))
                END AS signed_amount
            FROM wallet_transfers wt
            LEFT JOIN ads a ON wt.note ILIKE '%' || a.ad_id || '%'
            LEFT JOIN users owner ON a.user_id = owner.id
            LEFT JOIN users u ON wt.sender_id = u.id
            WHERE (
                wt.type = 'profile_promote'
                OR (
                    (wt.type = 'ad_refund' OR (wt.type = 'transfer' AND wt.note ILIKE 'Ad Refund - %'))
                    AND a.campaign_type = 'Profile Promote'
                )
            )
            ORDER BY wt.created_at DESC
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Photo / video + product promote ad collection history
router.get('/ad-promote-collection-detail', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                wt.id,
                wt.amount,
                wt.commission,
                wt.note,
                wt.status,
                wt.created_at,
                a.ad_id,
                COALESCE(owner.full_name, u.full_name) AS user_name,
                COALESCE(owner.user_id, u.user_id) AS user_readable_id,
                COALESCE(owner.username, u.username) AS username,
                CASE
                    WHEN COALESCE(a.campaign_type, '') IN ('Product Promote', 'Photo and Video') THEN a.campaign_type
                    WHEN wt.note ILIKE '%Product Promote%' THEN 'Product Promote'
                    WHEN wt.note ILIKE '%Photo Promote%' OR wt.note ILIKE '%Photo and Video%' THEN 'Photo and Video'
                    ELSE 'Ad Promote'
                END AS ad_category,
                CASE
                    WHEN wt.type = 'ad_refund' OR wt.note ILIKE 'Ad Refund - %' THEN 'refund'
                    ELSE 'credit'
                END AS event_type,
                CASE
                    WHEN wt.type = 'ad_refund' OR wt.note ILIKE 'Ad Refund - %'
                        THEN -ABS(COALESCE(wt.amount, 0))
                    ELSE ABS(COALESCE(NULLIF(wt.commission, 0), wt.amount, 0))
                END AS signed_amount
            FROM wallet_transfers wt
            LEFT JOIN ads a ON wt.note ILIKE '%' || a.ad_id || '%'
            LEFT JOIN users owner ON a.user_id = owner.id
            LEFT JOIN users u ON wt.sender_id = u.id
            WHERE (
                (wt.type = 'transfer' AND wt.note ILIKE 'Ad Promote - %')
                OR (
                    (wt.type = 'ad_refund' OR (wt.type = 'transfer' AND wt.note ILIKE 'Ad Refund - %'))
                    AND (
                        a.campaign_type IN ('Photo and Video', 'Product Promote')
                        OR wt.note ILIKE '%Product Promote%'
                        OR wt.note ILIKE '%Photo and Video%'
                    )
                )
            )
            ORDER BY wt.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Product commission history routed to Googer via completed orders
router.get('/product-commission-history', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                o.id AS order_id,
                o.status AS order_status,
                COALESCE(wt.amount, 0) AS commission_amount,
                wt.status AS transfer_status,
                wt.note,
                COALESCE(wt.created_at, o.created_at) AS created_at,
                seller.full_name AS seller_name,
                seller.username AS seller_username,
                seller.user_id AS seller_readable_id,
                buyer.full_name AS buyer_name,
                buyer.username AS buyer_username,
                buyer.user_id AS buyer_readable_id
            FROM orders o
            LEFT JOIN wallet_transfers wt ON wt.id = o.seller_commission_transfer_id
            LEFT JOIN users seller ON seller.id = o.seller_id
            LEFT JOIN users buyer ON buyer.id = o.buyer_id
            WHERE o.seller_commission_transfer_id IS NOT NULL
            ORDER BY COALESCE(wt.created_at, o.created_at) DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// All registered users list for admin transfer
router.get('/all-users-list', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, full_name, username, user_id, wallet_balance, user_type, profile_picture
            FROM users
            ORDER BY full_name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Admin-to-user direct transfer history
router.get('/user-transfer-history', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                wt.id, wt.amount, wt.note, wt.created_at,
                s.full_name  AS sender_name,
                s.username   AS sender_username,
                s.user_type  AS sender_type,
                r.full_name  AS receiver_name,
                r.username   AS receiver_username,
                r.user_id    AS receiver_readable_id,
                r.user_type  AS receiver_type
            FROM wallet_transfers wt
            LEFT JOIN users s ON wt.sender_id  = s.id
            LEFT JOIN users r ON wt.receiver_id = r.id
            WHERE wt.type = 'transfer'
              AND wt.status = 'accepted'
              AND (LOWER(s.user_type) = 'admin' OR LOWER(s.user_type) = 'super_admin')
            ORDER BY wt.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Capital fund addition history (capital_add records)
router.get('/capital-add-history', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                wt.id, wt.amount, wt.note, wt.created_at,
                u.full_name AS sender_name,
                u.username,
                u.user_id  AS user_readable_id
            FROM wallet_transfers wt
            LEFT JOIN users u ON wt.sender_id = u.id
            WHERE wt.type = 'capital_add' AND wt.status = 'accepted'
            ORDER BY wt.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// P2P buy-coins transaction report history
router.get('/p2p-buy-transactions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                t.*,
                a.name AS ad_name,
                a.category,
                a.crypto_currency,
                a.admin_fields,
                a.lkr_rate,
                a.min_amount,
                a.max_amount,
                a.release_value,
                a.release_unit,
                a.description,
                buyer.username AS buyer_username,
                buyer.full_name AS buyer_name,
                buyer.user_id AS buyer_readable_id,
                seller.username AS seller_username,
                seller.full_name AS seller_name,
                seller.user_id AS seller_readable_id
            FROM p2p_transactions t
            LEFT JOIN p2p_buy_ads a ON a.id = t.ad_id
            LEFT JOIN users buyer ON buyer.id = t.buyer_id
            LEFT JOIN users seller ON seller.id = t.seller_id
            ORDER BY t.created_at DESC
            LIMIT 500
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch buy coins transactions' });
    }
});

// P2P sell-coins transaction report history
router.get('/p2p-sell-transactions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                t.*,
                a.name AS ad_name,
                a.category,
                a.crypto_currency,
                a.admin_fields,
                a.lkr_rate,
                a.min_amount,
                a.max_amount,
                a.release_value,
                a.release_unit,
                a.description,
                buyer.username AS buyer_username,
                buyer.full_name AS buyer_name,
                buyer.user_id AS buyer_readable_id,
                seller.username AS seller_username,
                seller.full_name AS seller_name,
                seller.user_id AS seller_readable_id
            FROM p2p_sell_transactions t
            LEFT JOIN p2p_sell_ads a ON a.id = t.ad_id
            LEFT JOIN users buyer ON buyer.id = t.buyer_id
            LEFT JOIN users seller ON seller.id = t.seller_id
            ORDER BY t.created_at DESC
            LIMIT 500
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch sell coins transactions' });
    }
});

// Capital-to-Googer transfer history (system_topup records)
router.get('/capital-transfer-history', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                wt.id, wt.commission AS transfer_amount, wt.note, wt.created_at,
                u.full_name   AS sender_name,
                u.username,
                u.user_id     AS user_readable_id
            FROM wallet_transfers wt
            LEFT JOIN users u ON wt.sender_id = u.id
            WHERE wt.type = 'system_topup' AND wt.status = 'accepted'
            ORDER BY wt.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Add capital funds directly to an admin's wallet_balance
router.post('/add-wallet-capital', async (req, res) => {
    const client = await pool.connect();
    let addAmount = null;
    try {
        const { amount } = req.body;
        const adminId = req.user.id;
        addAmount = normalizeMoney(amount);

        if (!addAmount || addAmount <= 0) {
            await audit(req, {
                action: 'admin.wallet_capital.add',
                status: 'rejected',
                target: { userId: adminId },
                amount: addAmount,
                details: { reason: 'invalid_amount' },
            });
            return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
        }

        await client.query('BEGIN');
        const idempotency = await claimFinanceIdempotencyKey(client, {
            scope: 'admin.add-wallet-capital',
            idempotencyKey: getIdempotencyKey(req),
            requestPayload: { amount: addAmount },
            actorUserId: adminId,
            targetUserId: adminId,
            amount: addAmount,
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

        const result = await client.query(
            `UPDATE users
             SET wallet_balance = wallet_balance + $1
             WHERE id = $2
               AND (
                   LOWER(REPLACE(REPLACE(TRIM(COALESCE(user_type, '')), ' ', '_'), '-', '_'))
                       IN ('admin', 'super_admin', 'superadmin', 'administrator')
                   OR LOWER(COALESCE(username, '')) = 'superadmin'
               )
             RETURNING id, wallet_balance`,
            [addAmount, adminId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Only admins can add capital funds' });
        }

        await client.query(
            `INSERT INTO wallet_transfers (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage)
             VALUES ($1, $1, $2, 'Admin Capital Fund Addition', 'capital_add', 'accepted', 0, 0)`,
            [adminId, addAmount]
        );

        const responseBody = { success: true, newBalance: parseFloat(result.rows[0].wallet_balance) };
        if (idempotency.recordId) {
            await completeFinanceIdempotencyKey(client, idempotency.recordId, responseBody);
        }
        await client.query('COMMIT');
        await audit(req, {
            action: 'admin.wallet_capital.add',
            status: 'success',
            target: { userId: adminId },
            amount: addAmount,
            details: { newBalance: parseFloat(result.rows[0].wallet_balance || 0) },
        });
        res.json(responseBody);
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error(err);
        await audit(req, {
            action: 'admin.wallet_capital.add',
            status: 'error',
            target: { userId: req.user?.id || null },
            amount: addAmount,
            error: err.message,
        });
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

router.post('/transfer-googer-to-admin', async (req, res) => {
    const client = await pool.connect();
    let targetAdminId = null;
    let transferAmount = null;
    try {
        const { adminId, amount } = req.body;
        targetAdminId = adminId;
        transferAmount = normalizeMoney(amount);

        if (!adminId || !transferAmount || transferAmount <= 0) {
            await audit(req, {
                action: 'admin.googer_balance.transfer',
                status: 'rejected',
                target: { userId: adminId || null },
                amount: transferAmount,
                details: { reason: 'invalid_input' },
            });
            return res.status(400).json({ success: false, message: 'Invalid admin ID or amount' });
        }

        await client.query('BEGIN');
        const idempotency = await claimFinanceIdempotencyKey(client, {
            scope: 'admin.transfer-googer-to-admin',
            idempotencyKey: getIdempotencyKey(req),
            requestPayload: { adminId, amount: transferAmount },
            actorUserId: req.user.id,
            targetUserId: adminId,
            amount: transferAmount,
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

        const googerState = await getLockedGoogerPooledState(client);
        if (!googerState?.userId) {
            await client.query('ROLLBACK');
            return res.status(500).json({ success: false, message: 'Googer pooled wallet is not configured.' });
        }
        const googerBalance = googerState.pooledBalance;

        if (googerBalance < transferAmount) {
            await client.query('ROLLBACK');
            await audit(req, {
                action: 'admin.googer_balance.transfer',
                status: 'rejected',
                target: { userId: adminId },
                amount: transferAmount,
                details: { reason: 'insufficient_googer_balance', googerBalance },
            });
            return res.status(400).json({ success: false, message: 'Insufficient Googer Balance' });
        }

        try {
            await creditAdminWalletFromGoogerPool(client, {
                adminId,
                amount: transferAmount,
                note: 'Googer Balance Payout',
                skipGoogerWalletLock: true,
            });
        } catch (financeErr) {
            if (financeErr.code === 'TARGET_NOT_ADMIN' || financeErr.code === 'USER_NOT_FOUND') {
                await client.query('ROLLBACK');
                await audit(req, {
                    action: 'admin.googer_balance.transfer',
                    status: 'rejected',
                    target: { userId: adminId },
                    amount: transferAmount,
                    details: { reason: 'target_not_admin' },
                });
                return res.status(400).json({ success: false, message: 'User is not an Admin or does not exist.' });
            }

            if (financeErr.code === 'GOOGER_WALLET_NOT_CONFIGURED') {
                await client.query('ROLLBACK');
                return res.status(500).json({ success: false, message: financeErr.message });
            }

            throw financeErr;
        }

        const responseBody = { success: true, message: 'Transfer successful' };
        if (idempotency.recordId) {
            await completeFinanceIdempotencyKey(client, idempotency.recordId, responseBody);
        }
        await client.query('COMMIT');
        await audit(req, {
            action: 'admin.googer_balance.transfer',
            status: 'success',
            target: { userId: adminId },
            amount: transferAmount,
            details: { googerBalanceBeforeTransfer: googerBalance },
        });
        res.status(200).json(responseBody);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        await audit(req, {
            action: 'admin.googer_balance.transfer',
            status: 'error',
            target: { userId: targetAdminId },
            amount: transferAmount,
            error: err.message,
        });
        res.status(500).json({ success: false, message: 'Server error processing transfer' });
    } finally {
        client.release();
    }
});

// All wallet_transfers â€” every row across all users
router.get('/all-transactions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                t.*,
                s.username        AS sender_username,
                s.full_name       AS sender_full_name,
                s.user_id         AS sender_readable_id,
                s.user_type       AS sender_user_type,
                r.username        AS receiver_username,
                r.full_name       AS receiver_full_name,
                r.user_id         AS receiver_readable_id,
                r.user_type       AS receiver_user_type
            FROM wallet_transfers t
            JOIN  users s ON t.sender_id   = s.id
            LEFT JOIN users r ON t.receiver_id = r.id
            ORDER BY t.created_at DESC
        `);
        res.json({ success: true, transactions: result.rows });
    } catch (err) {
        console.error('/admin/all-transactions error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Lightweight live pulse — presence counts only, safe to poll every 1-3 seconds.
// The full /traffic-analysis payload stays on a slow cadence (disk/S3/network probes are expensive).
router.get('/traffic-analysis/pulse', async (req, res) => {
    try {
        const hasPresence = await tableExists('chat_presence');
        if (!hasPresence) {
            return res.json({ success: true, generatedAt: new Date().toISOString(), available: false });
        }
        const [summary, recentUsers] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '20 seconds')::int AS active_concurrent_users,
                    COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '60 seconds')::int AS online_users,
                    COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '60 seconds' AND last_seen_at >= NOW() - INTERVAL '5 minutes')::int AS idle_users,
                    COUNT(*) FILTER (WHERE last_seen_at >= date_trunc('day', NOW()))::int AS daily_active_users,
                    COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days')::int AS monthly_active_users,
                    MAX(last_seen_at) AS latest_seen_at
                FROM chat_presence
            `),
            pool.query(`
                SELECT
                    cp.user_id,
                    u.username,
                    u.full_name,
                    u.user_type,
                    cp.last_seen_at,
                    GREATEST(0, EXTRACT(EPOCH FROM (NOW() - cp.last_seen_at))::int) AS seconds_ago
                FROM chat_presence cp
                LEFT JOIN users u ON u.id = cp.user_id
                ORDER BY cp.last_seen_at DESC
                LIMIT 12
            `),
        ]);
        const row = summary.rows[0] || {};
        const activeConcurrentUsers = trafficNumber(row.active_concurrent_users);
        res.json({
            success: true,
            generatedAt: new Date().toISOString(),
            available: true,
            activeConcurrentUsers,
            onlineUsers: trafficNumber(row.online_users),
            idleUsers: trafficNumber(row.idle_users),
            dailyActiveUsers: trafficNumber(row.daily_active_users),
            monthlyActiveUsers: trafficNumber(row.monthly_active_users),
            latestSeenAt: row.latest_seen_at,
            requestsPerSecond: trafficRound(activeConcurrentUsers > 0 ? activeConcurrentUsers / 20 : 0, 2),
            recentUsers: recentUsers.rows.map((user) => ({
                userId: user.user_id,
                username: user.username,
                fullName: user.full_name,
                userType: user.user_type,
                lastSeenAt: user.last_seen_at,
                secondsAgo: trafficNumber(user.seconds_ago, 999),
                status: trafficNumber(user.seconds_ago, 999) <= 20 ? 'active' : trafficNumber(user.seconds_ago, 999) <= 60 ? 'online' : 'idle',
            })),
        });
    } catch (err) {
        console.error('/admin/traffic-analysis/pulse error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/traffic-analysis', async (req, res) => {
    try {
        const hasPresence = await tableExists('chat_presence');
        const [summary, recentUsers, databaseStats, databaseSessions, diskSnapshot, networkSnapshot, localUploadBytes, objectStorage] = await Promise.all([
            hasPresence ? pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '20 seconds')::int AS active_concurrent_users,
                    COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '60 seconds')::int AS online_users,
                    COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '60 seconds' AND last_seen_at >= NOW() - INTERVAL '5 minutes')::int AS idle_users,
                    COUNT(*) FILTER (WHERE last_seen_at >= date_trunc('day', NOW()))::int AS daily_active_users,
                    COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days')::int AS monthly_active_users,
                    COUNT(*)::int AS total_tracked_users,
                    MAX(last_seen_at) AS latest_seen_at
                FROM chat_presence
            `) : Promise.resolve({ rows: [{}] }),
            hasPresence ? pool.query(`
                SELECT
                    cp.user_id,
                    u.username,
                    u.full_name,
                    u.user_type,
                    cp.last_seen_at,
                    GREATEST(0, EXTRACT(EPOCH FROM (NOW() - cp.last_seen_at))::int) AS seconds_ago
                FROM chat_presence cp
                LEFT JOIN users u ON u.id = cp.user_id
                ORDER BY cp.last_seen_at DESC
                LIMIT 12
            `) : Promise.resolve({ rows: [] }),
            pool.query(`
                SELECT
                    pg_database_size(current_database())::bigint AS database_size_bytes,
                    COALESCE(numbackends, 0)::int AS active_connections,
                    COALESCE(blks_read, 0)::bigint AS blks_read,
                    COALESCE(blks_hit, 0)::bigint AS blks_hit
                FROM pg_stat_database
                WHERE datname = current_database()
                LIMIT 1
            `).catch(() => ({ rows: [{}] })),
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE state = 'active')::int AS active_queries,
                    COUNT(*)::int AS total_sessions
                FROM pg_stat_activity
                WHERE datname = current_database()
            `).catch(() => ({ rows: [{}] })),
            Promise.resolve(getDiskSnapshot(process.cwd())),
            getNetworkTrafficSnapshot(),
            getDirectorySize(path.resolve(process.cwd(), '../googernew-main/backend/public/uploads')),
            getObjectStorageSnapshot(),
        ]);

        const row = summary.rows[0] || {};
        const dbRow = databaseStats.rows[0] || {};
        const dbSessionRow = databaseSessions.rows[0] || {};
        const activeConcurrentUsers = trafficNumber(row.active_concurrent_users);
        const onlineUsers = trafficNumber(row.online_users);
        const dailyActiveUsers = trafficNumber(row.daily_active_users);
        const monthlyActiveUsers = trafficNumber(row.monthly_active_users);
        const totalMemoryBytes = os.totalmem();
        const freeMemoryBytes = os.freemem();
        const usedMemoryBytes = Math.max(0, totalMemoryBytes - freeMemoryBytes);
        const memoryUsagePercent = trafficPercent(usedMemoryBytes, totalMemoryBytes);
        const cpuCores = Math.max(1, os.cpus()?.length || 1);
        const cpuUsagePercent = process.platform === 'win32'
            ? null
            : trafficClamp(trafficRound((os.loadavg()[0] / cpuCores) * 100), 0, 100);
        const cacheTotal = trafficNumber(dbRow.blks_read) + trafficNumber(dbRow.blks_hit);
        const cacheHitRatio = cacheTotal > 0 ? trafficPercent(dbRow.blks_hit, cacheTotal) : 0;
        const topology = detectTrafficTopology();
        const requestsPerSecond = trafficRound(activeConcurrentUsers > 0 ? activeConcurrentUsers / 20 : 0, 2);
        const estimatedMaximumConcurrentUsers = Math.max(
            50,
            Math.round(cpuCores * 220 * (freeMemoryBytes / (1024 ** 3) / 2) * (topology === 'split-services' ? 1.2 : 1)),
        );
        const currentUtilizationPercent = trafficClamp(Math.max(
            trafficNumber(cpuUsagePercent),
            memoryUsagePercent,
            trafficNumber(diskSnapshot.usagePercent),
            trafficPercent(activeConcurrentUsers, estimatedMaximumConcurrentUsers),
        ), 0, 100);
        const capacityRemainingUsers = Math.max(0, estimatedMaximumConcurrentUsers - activeConcurrentUsers);
        const forecastGrowth = Math.max(0.08, Math.min(0.45, monthlyActiveUsers > 0 ? activeConcurrentUsers / Math.max(1, monthlyActiveUsers) : 0.12));
        const forecastWindows = [1, 3, 6, 12].map((months) => {
            const multiplier = Math.pow(1 + forecastGrowth, months);
            const estimatedConcurrentUsers = Math.max(activeConcurrentUsers, Math.round(Math.max(1, activeConcurrentUsers || onlineUsers || 1) * multiplier));
            return {
                months,
                estimatedConcurrentUsers,
                estimatedStorageBytes: Math.round(trafficNumber(objectStorage.sizeBytes ?? localUploadBytes) * Math.pow(1.08, months)),
                estimatedBandwidthBytes: networkSnapshot.rxBytes !== null && networkSnapshot.txBytes !== null
                    ? Math.round((trafficNumber(networkSnapshot.rxBytes) + trafficNumber(networkSnapshot.txBytes)) * Math.pow(1.05, months))
                    : null,
                scalingRequired: estimatedConcurrentUsers > estimatedMaximumConcurrentUsers * 0.8,
            };
        });
        const health = [
            {
                label: 'Server',
                status: currentUtilizationPercent >= 85 ? 'warning' : 'healthy',
                detail: `${currentUtilizationPercent}% peak utilization`,
            },
            {
                label: 'Database',
                status: trafficNumber(dbSessionRow.total_sessions) >= 80 ? 'warning' : 'healthy',
                detail: `${trafficNumber(dbSessionRow.active_queries)} active queries / ${trafficNumber(dbSessionRow.total_sessions)} sessions`,
            },
            {
                label: 'Presence',
                status: hasPresence ? 'online' : 'warning',
                detail: hasPresence ? `${onlineUsers} online users detected` : 'chat_presence table is not available yet',
            },
        ];
        const alerts = [
            ...(memoryUsagePercent >= 85 ? [{ severity: 'critical', title: 'memory_high', message: `Memory usage is ${memoryUsagePercent}% and exceeds the safe threshold.` }] : []),
            ...(trafficNumber(diskSnapshot.usagePercent) >= 85 ? [{ severity: 'critical', title: 'disk_high', message: `Disk usage is ${diskSnapshot.usagePercent}% and exceeds the safe threshold.` }] : []),
            ...(!hasPresence ? [{ severity: 'warning', title: 'presence_missing', message: 'Live user presence table was not found, so concurrent users are estimated as zero.' }] : []),
        ];
        const recommendations = [];
        if (memoryUsagePercent >= 75) recommendations.push('Increase memory or split worker-heavy services into separate containers.');
        if (trafficNumber(diskSnapshot.usagePercent) >= 75) recommendations.push('Move uploads and media to object storage/CDN to reduce local disk pressure.');
        if (topology === 'single-server') recommendations.push('Prepare horizontal scaling by separating app, admin, workers, cache, and database responsibilities.');
        if (recommendations.length === 0) recommendations.push('Current operational signals are within safe bounds. Continue monitoring forecast windows for upcoming scale points.');
        const recentUserRows = recentUsers.rows.map((user) => ({
            userId: user.user_id,
            username: user.username,
            fullName: user.full_name,
            userType: user.user_type,
            lastSeenAt: user.last_seen_at,
            secondsAgo: trafficNumber(user.seconds_ago, 999),
            status: trafficNumber(user.seconds_ago, 999) <= 20 ? 'active' : trafficNumber(user.seconds_ago, 999) <= 60 ? 'online' : 'idle',
        }));

        res.json({
            success: true,
            generatedAt: new Date().toISOString(),
            overview: {
                hostingEnvironment: detectHostingEnvironment(),
                topology,
                separateDatabase: Boolean(process.env.DB_HOST && !/localhost|127\.0\.0\.1/i.test(String(process.env.DB_HOST))),
                separateStorage: Boolean(process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.STORAGE_BUCKET),
                objectStorageConfigured: Boolean(process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.STORAGE_BUCKET),
                redisConfigured: Boolean(process.env.REDIS_URL || process.env.REDIS_HOST),
                server: {
                    cpuCores,
                    cpuUsagePercent,
                    totalMemoryBytes,
                    usedMemoryBytes,
                    memoryUsagePercent,
                    disk: diskSnapshot,
                },
                database: {
                    activeConnections: trafficNumber(dbRow.active_connections),
                    activeQueries: trafficNumber(dbSessionRow.active_queries),
                    totalSessions: trafficNumber(dbSessionRow.total_sessions),
                    sizeBytes: trafficNumber(dbRow.database_size_bytes),
                    cacheHitRatio,
                },
                storage: {
                    localUploadBytes,
                    objectStorageBytes: objectStorage.sizeBytes,
                    objectCount: objectStorage.objectCount,
                    bucket: objectStorage.bucket,
                    region: objectStorage.region,
                    source: objectStorage.available ? 's3' : 'local',
                    available: objectStorage.available,
                    error: objectStorage.error || null,
                },
            },
            liveTraffic: {
                windowSeconds: 20,
                activeConcurrentUsers,
                onlineUsers,
                idleUsers: trafficNumber(row.idle_users),
                dailyActiveUsers,
                monthlyActiveUsers,
                totalTrackedUsers: trafficNumber(row.total_tracked_users),
                latestSeenAt: row.latest_seen_at,
                requestsPerSecond,
                apiResponseTimes: {
                    averageMs: 0,
                    maxMs: 0,
                },
                bandwidth: {
                    ingressBytes: networkSnapshot.rxBytes,
                    egressBytes: networkSnapshot.txBytes,
                },
                activityWindowMs: 20000,
                connectedSocketUsers: onlineUsers,
                recentUsers: recentUserRows,
            },
            performance: {
                health,
                slowRoutes: [],
            },
            scalability: {
                estimatedMaximumConcurrentUsers,
                capacityRemainingUsers,
                currentUtilizationPercent,
                scaleStatus: currentUtilizationPercent >= 80 ? 'scale soon' : 'stable',
                bottlenecks: [
                    { label: 'CPU', value: trafficNumber(cpuUsagePercent) },
                    { label: 'Memory', value: memoryUsagePercent },
                    { label: 'Disk', value: trafficNumber(diskSnapshot.usagePercent) },
                ].sort((left, right) => right.value - left.value).slice(0, 3),
            },
            forecast: {
                growthRate: forecastGrowth,
                windows: forecastWindows,
            },
            widgets: {
                cpu: [{ label: 'now', value: trafficNumber(cpuUsagePercent) }],
                memory: [{ label: 'now', value: memoryUsagePercent }],
                performance: [
                    { label: 'rps', value: requestsPerSecond },
                    { label: 'online', value: onlineUsers },
                    { label: 'active', value: activeConcurrentUsers },
                ],
                trafficForecast: forecastWindows.map((item) => ({ label: `${item.months}m`, value: item.estimatedConcurrentUsers })),
            },
            alerts: {
                items: alerts,
                recommendations,
            },
            recentUsers: recentUserRows,
            note: hasPresence ? undefined : 'chat_presence table is not available yet',
        });
    } catch (err) {
        console.error('/admin/traffic-analysis error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});
module.exports = router;
