const pool = require('./config/database');
async function check() {
  try {
    // Check if wallet_transfers exists
    const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
    console.log("Tables:", tables.rows.map(r => r.table_name).join(', '));

    const hasWT = tables.rows.some(r => r.table_name === 'wallet_transfers');
    if (hasWT) {
      const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='wallet_transfers'`);
      console.log("wallet_transfers columns:", cols.rows.map(c => c.column_name).join(', '));
    } else {
      console.log("wallet_transfers table does NOT exist");
    }
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
check();
