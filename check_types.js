const pool = require('./config/database');

async function checkTypes() {
  try {
    const marketRes = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'market' AND column_name = 'user_id'");
    const userRes = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND (column_name = 'id' OR column_name = 'user_id')");
    
    console.log("Market table user_id column:");
    console.log(marketRes.rows);
    console.log("\nUsers table id/user_id columns:");
    console.log(userRes.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTypes();
