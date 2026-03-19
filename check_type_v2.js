const pool = require('./config/database');

async function checkTypesDefinitive() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'market' AND column_name = 'user_id'
    `);
    console.log(JSON.stringify(res.rows));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTypesDefinitive();
