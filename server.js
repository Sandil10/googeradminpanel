require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve uploads from the googer-next public folder where they actually are
app.use('/uploads', express.static(path.join(__dirname, 'googer new', 'googer-next', 'public', 'uploads')));

// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Test DB Connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Database connected at:', res.rows[0].now);
        // Start background worker to cleanup deactivated users (Run every hour)
        setInterval(async () => {
            try {
                console.log("🧹 Running background cleanup for deactivated users...");
                const result = await pool.query(
                    "DELETE FROM users WHERE marked_for_deletion_at < NOW() - INTERVAL '7 days'"
                );
                if (result.rowCount > 0) {
                    console.log(`🗑️ Permanently deleted ${result.rowCount} user(s) after 7-day deactivation period.`);
                }
            } catch (err) {
                console.error("❌ Cleanup error:", err.message);
            }
        }, 1000 * 60 * 60);
    }
});

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const postRoutes = require('./routes/posts');
const walletRoutes = require('./routes/wallet');
const marketRoutes = require('./routes/market');
const orderRoutes = require('./routes/order');

const adminRoutes = require('./routes/admin');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/admin', adminRoutes);

// Basic route
app.get('/', (req, res) => {
    res.send('Googer Admin API is running...');
});

// Export the app for Vercel
module.exports = app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}
