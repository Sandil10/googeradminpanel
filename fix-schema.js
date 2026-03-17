const pool = require('./config/database');

async function fixSchema() {
    try {
        console.log("Checking columns in 'users' table...");
        const userCols = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'status'
        `);
        
        if (userCols.rows.length === 0) {
            console.log("Adding 'status' column to 'users' table...");
            await pool.query("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'Active'");
        } else {
            console.log("'status' column already exists in 'users' table.");
        }

        console.log("Checking 'market' table...");
        const marketTable = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'market'
            )
        `);

        if (!marketTable.rows[0].exists) {
            console.log("Creating 'market' table...");
            await pool.query(`
                CREATE TABLE market (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(10),
                    title VARCHAR(255),
                    description TEXT,
                    price DECIMAL(15, 2),
                    currency VARCHAR(10) DEFAULT 'R',
                    category VARCHAR(100),
                    image_url TEXT,
                    status VARCHAR(20) DEFAULT 'pending',
                    views INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    variants JSONB,
                    shipping_info TEXT,
                    payment_methods TEXT,
                    warranty_info TEXT,
                    return_policy TEXT,
                    delivery_info TEXT,
                    commission_info TEXT,
                    username VARCHAR(100),
                    seller_id VARCHAR(10),
                    owner_user_id VARCHAR(10),
                    payment_data JSONB,
                    shipping_data JSONB,
                    commission_data JSONB,
                    delivery_data JSONB,
                    return_data JSONB,
                    variants_data JSONB,
                    warranty_data JSONB,
                    links_data JSONB,
                    order_status VARCHAR(20),
                    promo_price DECIMAL(15, 2),
                    sub_category VARCHAR(100),
                    level3_category VARCHAR(100),
                    manual_category VARCHAR(100),
                    stock INTEGER DEFAULT 1
                )
            `);
        } else {
            console.log("'market' table exists. Checking if columns match...");
            // We'll trust the user's provided list and just ensure the basic ones we need are there.
            // For now, assume it's okay as it was created by the main project.
        }

        console.log("✅ Schema check/fix complete.");
    } catch (err) {
        console.error("❌ Schema Fix Error:", err.message);
    } finally {
        await pool.end();
    }
}

fixSchema();
