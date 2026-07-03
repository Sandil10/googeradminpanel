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

const sensitiveWriteLimiter = buildLimiter(
    toPositiveInt(process.env.SENSITIVE_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    toPositiveInt(process.env.SENSITIVE_RATE_LIMIT_MAX, 300),
    'Too many sensitive requests. Please slow down and try again.'
);

module.exports = {
    generalApiLimiter,
    authLimiter,
    sensitiveWriteLimiter,
};
