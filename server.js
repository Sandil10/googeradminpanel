require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const pool = require('./config/database');
const { assertFinanceSchemaReady } = require('../shared/utils/financeSchemaGuard');
const internalOpsAuth = require('../shared/utils/internalOpsAuth');
const { getBackgroundQueueMetrics, getBackgroundWorkerMetrics } = require('../shared/utils/backgroundMonitoring');
const internalServiceAuth = require('./middleware/internalServiceAuth');
const { authLimiter, generalApiLimiter, sensitiveWriteLimiter } = require('./middleware/rateLimiters');

const app = express();
const PORT = process.env.PORT || 3001;
app.set('trust proxy', Number.parseInt(String(process.env.TRUST_PROXY || '1'), 10) || 1);

// Middleware
const configuredOrigins = [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.WEB_URL,
    process.env.ADMIN_URL,
    'https://appadmin.infranex.it.com',
    'https://app.infranex.it.com',
];

const allowedOrigins = configuredOrigins
    .flatMap((origin) => String(origin || '').split(','))
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const devOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:6001',
    'http://127.0.0.1:6001',
];

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (process.env.NODE_ENV !== 'production') {
        return allowedOrigins.includes(origin)
            || devOrigins.includes(origin)
            || /^https?:\/\/([a-z0-9-]+\.)*infranex\.it\.com(?::\d+)?$/i.test(origin);
    }
    if (allowedOrigins.includes(origin)) return true;
    if (/^https?:\/\/([a-z0-9-]+\.)*infranex\.it\.com(?::\d+)?$/i.test(origin)) return true;
    return false;
};

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            return callback(null, true);
        }

        const normalizedOrigin = origin.replace(/\/+$/, '');

        if (isAllowedOrigin(normalizedOrigin)) {
            return callback(null, true);
        }

        console.warn(`[CORS] Blocked origin: ${normalizedOrigin}`);
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
app.use('/api', generalApiLimiter);

// Serve uploads - try the main backend's public folder, fallback to absolute path
const uploadDirs = [
    process.env.UPLOADS_DIR,
    path.resolve(__dirname, '..', 'googernew-main', 'public', 'uploads'),
    'C:\\Users\\Administrator\\Documents\\googernew-main\\public\\uploads',
].filter(Boolean);

uploadDirs.forEach((dir) => {
    const resolved = path.resolve(dir);
    if (fs.existsSync(resolved)) {
        app.use('/uploads', express.static(resolved));
    }
});

// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Test DB Connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
        return;
    }

    console.log('Database connected at:', res.rows[0].now);
    pool.query(
        `UPDATE users
         SET full_name = CASE
                 WHEN LOWER(REPLACE(COALESCE(user_type, ''), '-', '_')) IN ('super_admin', 'superadmin')
                     THEN 'Googer Support'
                 ELSE COALESCE(NULLIF(username, ''), full_name)
             END,
             profile_picture = CASE
                 WHEN LOWER(REPLACE(COALESCE(user_type, ''), '-', '_')) IN ('super_admin', 'superadmin')
                     THEN 'https://ui-avatars.com/api/?name=G&background=2563eb&color=ffffff&bold=true&size=128'
                 ELSE NULL
             END
         WHERE LOWER(REPLACE(COALESCE(user_type, ''), '-', '_')) IN ('super_admin', 'superadmin')
            OR (
                LOWER(COALESCE(user_type, '')) = 'admin'
                AND (
                    full_name = 'Googer Support'
                    OR profile_picture = 'https://ui-avatars.com/api/?name=G&background=2563eb&color=ffffff&bold=true&size=128'
                )
            )`
    ).then((result) => {
        if (result.rowCount > 0) {
            console.log('Admin user branded as "Googer Support" with G avatar');
        }
    }).catch((error) => console.error('Failed to update admin branding:', error.message));
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
const reportsRoutes = require('./routes/reports');
const notificationsRoutes = require('./routes/notifications');

// Use Routes
app.use('/api/auth', authLimiter, authRoutes);
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
app.use('/api/admin', sensitiveWriteLimiter, adminOtpRoutes);
app.use('/api/admin', sensitiveWriteLimiter, adminRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/withdrawal-admin', sensitiveWriteLimiter, withdrawalAdminRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/coin-requests', coinRequestsRoutes);
app.use('/api/admin/subscription-plans', sensitiveWriteLimiter, subscriptionPlansRoutes);

// Public badge lookup - no auth, used by the main Googer app to show verified badge
const subscriptionCtrl = require('./controllers/subscriptionPlansController');
const publicSubRouter = express.Router();
publicSubRouter.get('/badge/:userId', subscriptionCtrl.getBadgeForUser);
publicSubRouter.post('/apply-plan-badge', sensitiveWriteLimiter, internalServiceAuth, subscriptionCtrl.applyPlanBadge);
app.use('/api/subscriptions', publicSubRouter);
app.use('/api/admin/referrals', referralsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = await pool.query('SELECT NOW() AS now');
        res.status(200).json({
            success: true,
            service: 'googer-admin',
            database: 'Connected',
            timestamp: dbStatus.rows[0].now,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            service: 'googer-admin',
            message: 'Googer admin API running but Database connection failed',
            error: error.message,
        });
    }
});

app.get('/api/ops/health', internalOpsAuth, async (req, res) => {
    try {
        const [dbStatus, queueMetrics, workerMetrics] = await Promise.all([
            pool.query('SELECT NOW() AS now'),
            getBackgroundQueueMetrics(pool, { queueName: 'googer-admin' }),
            getBackgroundWorkerMetrics(pool, { serviceName: 'googer-admin', queueName: 'googer-admin' }),
        ]);

        const hasFailedJobs = Number(queueMetrics.summary.failed_jobs || 0) > 0;
        const hasStaleWorkers = Number(workerMetrics.summary.stale_workers || 0) > 0;
        const statusCode = hasFailedJobs || hasStaleWorkers ? 503 : 200;

        res.status(statusCode).json({
            success: statusCode === 200,
            service: 'googer-admin',
            database: 'Connected',
            queue: queueMetrics.summary,
            workers: workerMetrics.summary,
            checks: {
                failedJobs: hasFailedJobs ? 'degraded' : 'ok',
                staleWorkers: hasStaleWorkers ? 'degraded' : 'ok',
            },
            timestamp: dbStatus.rows[0].now,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            service: 'googer-admin',
            message: 'Failed to collect ops health',
            error: error.message,
        });
    }
});

app.get('/api/ops/metrics', internalOpsAuth, async (req, res) => {
    try {
        const [queueMetrics, workerMetrics] = await Promise.all([
            getBackgroundQueueMetrics(pool, { queueName: 'googer-admin' }),
            getBackgroundWorkerMetrics(pool, {
                serviceName: 'googer-admin',
                queueName: 'googer-admin',
                staleAfterSeconds: Number(process.env.WORKER_STALE_AFTER_SECONDS || 120),
            }),
        ]);

        res.status(200).json({
            success: true,
            service: 'googer-admin',
            queue: queueMetrics,
            workers: workerMetrics,
            generatedAt: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            service: 'googer-admin',
            message: 'Failed to collect ops metrics',
            error: error.message,
        });
    }
});

async function startServer() {
    await assertFinanceSchemaReady(pool);

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

module.exports = app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    startServer().catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}
