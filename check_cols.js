const pool = require('./config/database');

async function checkFullSchema() {
  try {
    const res = await pool.query("SELECT * FROM market LIMIT 0");
    console.log(res.fields.map(f => f.name));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkFullSchema();
