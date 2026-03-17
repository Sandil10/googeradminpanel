const pool = require('./config/database');

async function testSchema() {
    try {
        console.log("Checking users table schema...");
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log("Columns found in 'users' table:");
        console.table(result.rows);
        
        console.log("\nFetching first 5 rows...");
        const data = await pool.query('SELECT * FROM users LIMIT 5');
        console.table(data.rows);
    } catch (err) {
        console.error("❌ ERROR:", err.message);
    } finally {
        await pool.end();
    }
}

testSchema();
