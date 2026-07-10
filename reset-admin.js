const bcrypt = require('bcryptjs');

// New admin credentials
const newPassword = 'AdminGooger@2024';
const username = 'superadmin';
const email = 'admin1@gmail.com';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                  ADMIN PASSWORD RESET UTILITY                  ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

bcrypt.hash(newPassword, 10, (err, hash) => {
    if (err) {
        console.error('❌ Error generating hash:', err.message);
        process.exit(1);
    }
    
    console.log('✓ Hash Generated Successfully');
    console.log('');
    console.log('📝 NEW ADMIN CREDENTIALS:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('  Username: ' + username);
    console.log('  Email:    ' + email);
    console.log('  Password: ' + newPassword);
    console.log('─────────────────────────────────────────────────────────────');
    console.log('');
    console.log('🔐 DATABASE UPDATE COMMAND:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('UPDATE users SET password = \'%s\'', hash);
    console.log('WHERE user_id = \'000001\';');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('');
    console.log('📊 Connection Details:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('  Host:     googer-postgres.c9es4i0q0j09.eu-north-1.rds.amazonaws.com');
    console.log('  Port:     5432');
    console.log('  Database: googer');
    console.log('  User:     googer_app');
    console.log('  SSL:      Enabled');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('');
    console.log('✅ Reset using psql, MySQL Workbench, or AWS RDS Console');
    console.log('');
});
