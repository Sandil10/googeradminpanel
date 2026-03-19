const pool = require('./config/database');

async function testFetchFinal() {
  try {
    const query = `
      SELECT m.*, 
             COALESCE(u.id, m.user_id) as user_id,
             COALESCE(u.user_id, m.owner_user_id) as seller_id,
             COALESCE(u.username, m.username) as username,
             u.full_name
      FROM market m
      LEFT JOIN users u ON (m.user_id = u.id OR m.owner_user_id = u.user_id)
      ORDER BY m.created_at DESC
    `;
    const result = await pool.query(query);
    console.log("Success! Row count:", result.rows.length);
    if (result.rows.length > 0) {
        console.log("Sample User ID (Display):", result.rows[0].seller_id);
    }
    process.exit(0);
  } catch (err) {
    console.error("❌ SQL Error!");
    console.error(err.message);
    process.exit(1);
  }
}

testFetchFinal();
