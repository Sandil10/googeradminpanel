const pool = require('./config/database');
const fs = require('fs');

async function testSchema() {
    let output = "";
    try {
        const resConn = await pool.query('SELECT NOW()');
        output += `✅ Connected at: ${resConn.rows[0].now}\n\n`;
        
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        output += "Columns in 'users' table:\n";
        result.rows.forEach(row => {
            output += `- ${row.column_name} (${row.data_type})\n`;
        });
        
        output += "\nFirst 2 rows:\n";
        const data = await pool.query('SELECT * FROM users LIMIT 2');
        output += JSON.stringify(data.rows, null, 2);
    } catch (err) {
        output += `❌ ERROR: ${err.message}\n`;
    } finally {
        await pool.end();
        fs.writeFileSync('db-verify.txt', output);
    }
}

testSchema();
