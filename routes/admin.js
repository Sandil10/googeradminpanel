const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/stats', async (req, res) => {
    try {
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const sellersCount = await pool.query("SELECT COUNT(*) FROM users WHERE LOWER(user_type) = 'seller'");
        const pendingProducts = await pool.query("SELECT COUNT(*) FROM market WHERE status IN ('pending', 'reviewing')");
        const totalBalance = await pool.query('SELECT SUM(wallet_balance) FROM users');
        const commissions = await pool.query("SELECT SUM(commission) FROM wallet_transfers WHERE status = 'accepted'");

        res.json({
            totalUsers: usersCount.rows[0].count,
            activeSellers: sellersCount.rows[0].count,
            pendingProducts: pendingProducts.rows[0].count,
            totalUsersBalance: totalBalance.rows[0].sum || 0,
            googerBalance: commissions.rows[0].sum || 0
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


router.post('/transfer-googer-to-admin', async (req, res) => {
    const client = await pool.connect();
    try {
        const { adminId, amount } = req.body;
        const transferAmount = parseFloat(amount);

        if (!adminId || !transferAmount || transferAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid admin ID or amount' });
        }

        await client.query('BEGIN');

        // Check Googer Balance
        const commissions = await client.query("SELECT SUM(commission) FROM wallet_transfers WHERE status = 'accepted'");
        const googerBalance = parseFloat(commissions.rows[0].sum || 0);

        if (googerBalance < transferAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Insufficient Googer Balance' });
        }

        // Add to Admin User Wallet
        const updateResult = await client.query(
            'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 AND (user_type ILIKE $3 OR user_type ILIKE $4) RETURNING id',
            [transferAmount, adminId, 'admin', 'super_admin']
        );

        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'User is not an Admin or does not exist.' });
        }

        // Deduct from Googer Balance by inserting negative commission
        await client.query(
            `INSERT INTO wallet_transfers (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage)
             VALUES ($1, $1, $2, 'Googer Balance Payout', 'system_payout', 'accepted', $3, 0)`,
            [adminId, transferAmount, -transferAmount]
        );

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'Transfer successful' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error processing transfer' });
    } finally {
        client.release();
    }
});

module.exports = router;
