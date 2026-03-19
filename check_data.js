const pool = require('./config/database');

async function checkSampleData() {
  try {
    const marketSample = await pool.query('SELECT user_id, seller_id FROM market LIMIT 5');
    const userSample = await pool.query('SELECT id, user_id FROM users LIMIT 5');
    
    console.log("Market user_id samples:");
    console.log(marketSample.rows);
    console.log("\nUsers ID/user_id samples:");
    console.log(userSample.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSampleData();
