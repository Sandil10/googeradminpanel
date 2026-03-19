const pool = require('./config/database');

async function checkIds() {
  try {
    const marketAll = await pool.query('SELECT user_id FROM market LIMIT 50');
    console.log("Unique user_ids in market table:");
    console.log([...new Set(marketAll.rows.map(r => r.user_id))]);
    
    const userAll = await pool.query('SELECT id, user_id FROM users LIMIT 100');
    console.log("\nSample User IDs:");
    console.log(userAll.rows.slice(0, 5));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkIds();
