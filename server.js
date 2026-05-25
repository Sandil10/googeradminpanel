require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const devOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
];

app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            return callback(null, true);
        }

        if (
            allowedOrigins.includes(origin) ||
            (process.env.NODE_ENV !== 'production' && devOrigins.includes(origin)) ||
            (process.env.NODE_ENV !== 'production' && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(origin)) ||
            (process.env.NODE_ENV !== 'production' && /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i.test(origin))
        ) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
});
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '1mb' }));
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
const adsRoutes = require('./routes/ads');
const categoriesRoutes = require('./routes/categories');
const adminCustomizationRoutes = require('./routes/admin-customization');
const chatRoutes = require('./routes/chat');
const promoCodesRoutes = require('./routes/promo-codes');
const adminOtpRoutes = require('./routes/admin-otp');

const adminRoutes = require('./routes/admin');
const verificationRoutes = require('./routes/verification');
const withdrawalAdminRoutes = require('./routes/withdrawal-admin');
const withdrawalRoutes = require('./routes/withdrawal');
const coinRequestsRoutes = require('./routes/coin-requests');
const subscriptionPlansRoutes = require('./routes/subscription-plans');
const referralsRoutes = require('./routes/referrals');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/admin/customization', adminCustomizationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/promo-codes', promoCodesRoutes);
app.use('/api/admin', adminOtpRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/withdrawal-admin', withdrawalAdminRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/coin-requests', coinRequestsRoutes);
app.use('/api/admin/subscription-plans', subscriptionPlansRoutes);
app.use('/api/admin/referrals', referralsRoutes);

async function startServer() {
    if (process.env.SERVE_NEXT === 'true') {
        const next = require('next');
        const nextApp = next({ dev: false, dir: __dirname });
        const handle = nextApp.getRequestHandler();

        await nextApp.prepare();
        app.all('*', (req, res) => handle(req, res));
    } else {
        app.get('/', (req, res) => {
            res.send('Googer Admin API is running...');
        });
    }

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export the app for Vercel and tests.
module.exports = app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    startServer().catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}
