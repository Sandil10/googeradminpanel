#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: 'googer-postgres.c9es4i0q0j09.eu-north-1.rds.amazonaws.com',
    port: 5432,
    database: 'googer',
    user: 'googer_app',
    password: 'qW5KHvm0Oo7gTI0O9Ni9i0jtuzwX',
    ssl: {
        rejectUnauthorized: false
    }
});

const newPassword = 'AdminGooger@2024';

async function updateAdminPassword() {
    try {
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║              ADMIN PASSWORD DATABASE UPDATE TOOL                ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        console.log('⏳ Connecting to database...');

        // Test connection
        const testResult = await pool.query('SELECT NOW()');
        console.log('✅ Database connected\n');

        // Check if admin user exists
        console.log('🔍 Checking for admin user (000001)...');
        const checkResult = await pool.query(
            'SELECT user_id, username, email, user_type FROM users WHERE user_id = $1',
            ['000001']
        );

        if (checkResult.rows.length === 0) {
            console.error('❌ Admin user not found with ID 000001');
            process.exit(1);
        }

        const adminUser = checkResult.rows[0];
        console.log(`✓ Found user: ${adminUser.username} (${adminUser.email})`);
        console.log(`  Type: ${adminUser.user_type}\n`);

        // Generate new password hash
        console.log('⏳ Generating password hash...');
        const passwordHash = await bcrypt.hash(newPassword, 10);
        console.log('✅ Hash generated\n');

        // Update password
        console.log('⏳ Updating password in database...');
        const updateResult = await pool.query(
            'UPDATE users SET password = $1 WHERE user_id = $2 RETURNING user_id, username, email',
            [passwordHash, '000001']
        );

        if (updateResult.rows.length === 0) {
            console.error('❌ Failed to update password');
            process.exit(1);
        }

        console.log('✅ Password updated successfully\n');

        // Verify the update
        console.log('🔐 Verifying password update...');
        const verifyResult = await pool.query(
            'SELECT user_id, username, email FROM users WHERE user_id = $1',
            ['000001']
        );

        if (verifyResult.rows.length > 0) {
            const user = verifyResult.rows[0];
            console.log(`✓ User verified: ${user.username} (${user.email})\n`);
        }

        // Display credentials
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║                  ✅ PASSWORD UPDATED SUCCESSFULLY                ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        console.log('📝 NEW LOGIN CREDENTIALS:');
        console.log('─────────────────────────────────────────────────────────────');
        console.log(`  URL:      https://admin.googer.site`);
        console.log(`  Username: ${adminUser.username}`);
        console.log(`  Email:    ${adminUser.email}`);
        console.log(`  Password: ${newPassword}`);
        console.log('─────────────────────────────────────────────────────────────\n');

        console.log('🚀 You can now log in to the admin panel!');
        console.log('\nIf you still get "Invalid credentials":');
        console.log('  1. Clear browser cache (Ctrl+Shift+Delete)');
        console.log('  2. Try incognito/private mode');
        console.log('  3. Wait 30 seconds for database sync');
        console.log('  4. Restart the admin backend service\n');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('\nIf connection failed:');
        console.error('  - Check AWS security group allows your IP');
        console.error('  - Verify credentials are correct');
        console.error('  - Ensure RDS instance is running\n');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

updateAdminPassword();
