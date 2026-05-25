const pool = require('../config/database');

async function resetGoogerBalance() {
    try {
        console.log('Connecting to database...');
        
        // 1. Get current balance
        const balanceRes = await pool.query("SELECT SUM(commission) as total FROM wallet_transfers WHERE status = 'accepted'");
        const currentBalance = parseFloat(balanceRes.rows[0].total || 0);
        
        console.log(`Current Googer Balance: ${currentBalance}`);
        
        if (currentBalance === 0) {
            console.log('Balance is already 0.00');
            process.exit(0);
        }

        // 2. Get an ID to associate with the transaction
        let adminRes = await pool.query("SELECT id FROM users WHERE user_type ILIKE 'admin' OR user_type ILIKE 'super_admin' LIMIT 1");
        if (adminRes.rows.length === 0) {
            console.log('No admin user found, falling back to first available user.');
            adminRes = await pool.query("SELECT id FROM users LIMIT 1");
        }
        
        if (adminRes.rows.length === 0) {
            console.error('No users found in the database.');
            process.exit(1);
        }
        const adminId = adminRes.rows[0].id;

        // 3. Insert a balancing entry to make the sum 0
        const adjustment = -currentBalance;
        await pool.query(
            `INSERT INTO wallet_transfers (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage)
             VALUES ($1, $1, 0, $2, 'system_adjustment', 'accepted', $3, 0)`,
            [adminId, 'Manual Balance Reset to 0.00', adjustment]
        );

        console.log(`Successfully added adjustment of ${adjustment}. New Googer Balance should be 0.00.`);
        
        // 4. Verify
        const newBalanceRes = await pool.query("SELECT SUM(commission) as total FROM wallet_transfers WHERE status = 'accepted'");
        console.log(`Verified New Googer Balance: ${newBalanceRes.rows[0].total || 0}`);
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

resetGoogerBalance();
