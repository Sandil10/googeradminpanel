/**
 * Run once to create the admin test account:
 *   node scratch/seed-admin-user.js
 */
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function seedAdmin() {
    const email = 'admin@gmail.com';
    const password = '1234';
    const username = 'admin';
    const fullName = 'Administrator';

    const hash = await bcrypt.hash(password, 10);

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
        console.log('Admin user already exists — updating password and user_type.');
        await pool.query(
            `UPDATE users SET password = $1, user_type = 'admin' WHERE email = $2`,
            [hash, email]
        );
        console.log('Done.');
        await pool.end();
        return;
    }

    // Generate a unique 4-digit user_id
    let userId;
    while (true) {
        userId = Math.floor(1000 + Math.random() * 9000).toString();
        const r = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
        if (r.rows.length === 0) break;
    }

    await pool.query(
        `INSERT INTO users (user_id, username, full_name, email, password, user_type, referral_code, wallet_balance)
         VALUES ($1, $2, $3, $4, $5, 'admin', 'REF-ADM-0001', 0.00)`,
        [userId, username, fullName, email, hash]
    );

    console.log(`Admin user created — email: ${email}  password: ${password}`);
    await pool.end();
}

seedAdmin().catch(e => { console.error(e); process.exit(1); });
