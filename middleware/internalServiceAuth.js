const authMiddleware = require('./auth');
const adminOnly = require('./adminOnly');

function getConfiguredTokens() {
    return [
        process.env.INTERNAL_SERVICE_TOKEN,
        process.env.MAIN_APP_INTERNAL_TOKEN,
        process.env.GOOGER_INTERNAL_SERVICE_TOKEN,
    ]
        .flatMap((value) => String(value || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean);
}

function extractServiceToken(req) {
    const directHeader = req.get('x-internal-service-token') || req.get('x-googer-service-token');
    if (directHeader) return directHeader.trim();

    const authHeader = req.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
}

module.exports = function internalServiceAuth(req, res, next) {
    const configuredTokens = getConfiguredTokens();
    const providedToken = extractServiceToken(req);

    if (providedToken && configuredTokens.includes(providedToken)) {
        req.internalService = {
            name: req.get('x-internal-service-name') || 'internal-service',
        };
        return next();
    }

    return authMiddleware(req, res, () => adminOnly(req, res, next));
};
