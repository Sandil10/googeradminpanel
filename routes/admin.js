const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/stats', async (req, res) => {
    try {
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const sellersCount = await pool.query("SELECT COUNT(*) FROM users WHERE user_type = 'seller'");
        const pendingProducts = await pool.query("SELECT COUNT(*) FROM market WHERE status = 'pending' OR status = 'reviewing'");
        const totalBalance = await pool.query("SELECT SUM(wallet_balance) FROM users");
        
        res.json({
            totalUsers: usersCount.rows[0].count,
            activeSellers: sellersCount.rows[0].count,
            pendingProducts: pendingProducts.rows[0].count,
            totalRevenue: totalBalance.rows[0].sum || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

module.exports = router;
