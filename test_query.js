const pool = require('./config/database');

async function testFetch() {
  try {
    const { status } = {};
    let query = `
      SELECT m.*, 
             COALESCE(u.id, CASE WHEN m.user_id ~ '^[0-9]+$' THEN m.user_id::integer ELSE NULL END) as user_id,
             COALESCE(u.user_id, m.owner_user_id) as seller_id,
             COALESCE(u.username, m.username) as username,
             u.full_name
      FROM market m
      LEFT JOIN users u ON (
        (m.user_id ~ '^[0-9]+$' AND m.user_id::integer = u.id) OR 
        (m.user_id = u.user_id) OR
        (m.owner_user_id = u.user_id)
      )
    `;
    let params = [];
    
    query += ' ORDER BY m.created_at DESC';
    const result = await pool.query(query, params);
    console.log("Success! Row count:", result.rows.length);
    process.exit(0);
  } catch (err) {
    console.error("❌ SQL Error!");
    console.error(err.message);
    process.exit(1);
  }
}

testFetch();
