const pool = require('./config/database');

async function run() {
    try {
        const query = process.argv[2] || 'SELECT user_type, COUNT(*) FROM users GROUP BY user_type';
        console.log("--- START TEST ---");
        console.log("RUNNING:", query);
        const res = await pool.query(query);
        console.log("RESULT:", JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error("FAIL:", e.message);
    } finally {
        await pool.end();
        console.log("--- END TEST ---");
    }
}

run();
