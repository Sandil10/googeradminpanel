const { rateLimit } = require('express-rate-limit');

function toPositiveInt(value, fallback) {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildLimiter(windowMs, max, message, options = {}) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message },
        ...options,
    });
}

function skipOperationalHealth(req) {
    return req.path === '/health'
        || req.path === '/ops/health'
        || req.path === '/ops/metrics'
        || req.path === '/ops/prometheus'
        || req.path === '/ops/alerts';
}

const generalApiLimiter = buildLimiter(
    toPositiveInt(process.env.GENERAL_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    toPositiveInt(process.env.GENERAL_RATE_LIMIT_MAX, 5000),
    'Too many requests. Please try again shortly.',
    { skip: skipOperationalHealth }
);

const authLimiter = buildLimiter(
    toPositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    toPositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 200),
    'Too many authentication requests. Please wait a moment.'
);

const sensitiveWriteBucket = buildLimiter(
    toPositiveInt(process.env.SENSITIVE_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    toPositiveInt(process.env.SENSITIVE_RATE_LIMIT_MAX, 300),
    'Too many sensitive requests. Please slow down and try again.'
);

// Only writes are "sensitive". Reads (the admin tables' auto-refresh) used to
// count too, and a request under /api/admin/... passed this limiter at more
// than one mount, so it was counted twice. Open admin pages then used up the
// 300 allowance within minutes and saves (e.g. Assign plan / Save badge) and
// table loads were rejected with 429. Count each write request once.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
function sensitiveWriteLimiter(req, res, next) {
    if (SAFE_METHODS.has(req.method) || req._sensitiveWriteLimited) return next();
    req._sensitiveWriteLimited = true;
    return sensitiveWriteBucket(req, res, next);
}

module.exports = {
    generalApiLimiter,
    authLimiter,
    sensitiveWriteLimiter,
};
