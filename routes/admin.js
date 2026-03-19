const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/stats', async (req, res) => {
    try {
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const sellersCount = await pool.query("SELECT COUNT(*) FROM users WHERE user_type = 'seller'");
        const pendingProducts = await pool.query("SELECT COUNT(*) FROM market WHERE status = 'pending' OR status = 'reviewing'");
        const totalBalance = await pool.query("SELECT SUM(wallet_balance) FROM users");
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
        res.status(500).send(err.message);
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

router.get('/all-transactions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, 
                   s.username as sender_username, s.full_name as sender_full_name, s.user_id as sender_readable_id,
                   r.username as receiver_username, r.full_name as receiver_full_name, r.user_id as receiver_readable_id
            FROM wallet_transfers t
            LEFT JOIN users s ON t.sender_id = s.id
            LEFT JOIN users r ON t.receiver_id = r.id
            ORDER BY t.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

module.exports = router;
