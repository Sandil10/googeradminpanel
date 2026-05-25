/**
 * DB Reset Script
 * Run once with: node reset-db.js
 *
 * What it does:
 *  1. Clears all wallet_transfers (zeros Googer balance, profile promote, capital transfer history)
 *  2. Clears all ad_coin_collections (zeros ad coin collect balance)
 *  3. Sets all users wallet_balance to 0
 *  4. Sets the @admin system account wallet_balance to 100,000
 *  5. Inserts one capital_add record of R 100,000 linked to the @admin account
 */

require('dotenv').config();
const pool = require('./config/database');

async function reset() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Clear all transaction history
        await client.query('DELETE FROM wallet_transfers');
        console.log('✅ wallet_transfers cleared');

        // 2. Clear ad coin collections
        await client.query('DELETE FROM ad_coin_collections');
        console.log('✅ ad_coin_collections cleared');

        // 3. Reset all users wallet_balance to 0
        await client.query('UPDATE users SET wallet_balance = 0');
        console.log('✅ All user wallet balances reset to 0');

        // 4. Set @admin wallet_balance to 100,000
        const adminResult = await client.query(
            "UPDATE users SET wallet_balance = 100000 WHERE username = 'admin' RETURNING id, username, wallet_balance"
        );
        if (adminResult.rows.length === 0) {
            throw new Error('Could not find @admin account — aborting');
        }
        const adminId = adminResult.rows[0].id;
        console.log(`✅ @admin wallet_balance set to R 100,000 (DB id: ${adminId})`);

        // 5. Insert one capital_add record of R 100,000
        await client.query(
            `INSERT INTO wallet_transfers
                (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage)
             VALUES ($1, $1, 100000, 'Admin Capital Fund Addition', 'capital_add', 'accepted', 0, 0)`,
            [adminId]
        );
        console.log('✅ Capital Add record inserted: R 100,000');

        await client.query('COMMIT');
        console.log('\n🎉 Reset complete. Summary:');
        console.log('   • All wallet_transfers cleared');
        console.log('   • All ad_coin_collections cleared');
        console.log('   • All user wallet_balances → R 0');
        console.log('   • @admin wallet_balance → R 100,000');
        console.log('   • Capital Add history → 1 record (R 100,000)');
        console.log('   • Googer Balance → R 0');
        console.log('   • Ad Coin Collect → R 0');
        console.log('   • Profile Promote → R 0');
        console.log('   • Capital Transfer → R 0');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Reset failed — rolled back:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

reset();
