const pool = require('./config/database');

async function migrate() {
    try {
        console.log("Checking columns in 'users' table...");
        const cols = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'marked_for_deletion_at'
        `);
        
        if (cols.rows.length === 0) {
            console.log("Adding 'marked_for_deletion_at' column to 'users' table...");
            await pool.query("ALTER TABLE users ADD COLUMN marked_for_deletion_at TIMESTAMP DEFAULT NULL");
        } else {
            console.log("'marked_for_deletion_at' column already exists.");
        }
        
        console.log("✅ Migration complete.");
    } catch (err) {
        console.error("❌ Migration Error:", err.message);
    } finally {
        await pool.end();
    }
}

migrate();
