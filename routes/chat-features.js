const { Readable } = require('node:stream');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// Chat Features + Stickers & Emojis settings live in the main backend (it owns
// media storage). The main backend can't read this panel's login tokens (they
// are signed with a different secret), so this checks the admin here and then
// forwards the request with the shared INTERNAL_SERVICE_TOKEN. Mounted before
// the body parsers so image uploads stream through untouched.
const SKIP_HEADERS = new Set(['connection', 'content-length', 'host', 'keep-alive', 'transfer-encoding', 'upgrade', 'authorization', 'cookie']);

const mainBase = () => String(process.env.GOOGER_MAIN_API_URL || process.env.MAIN_BACKEND_URL || 'http://127.0.0.1:5000')
    .trim()
    .replace(/\/+$/, '');

const forward = async (req, res) => {
    const token = String(process.env.INTERNAL_SERVICE_TOKEN || '').trim();
    if (!token) {
        return res.status(503).json({ success: false, message: 'Chat features are not configured on the server.' });
    }
    try {
        const headers = {};
        Object.entries(req.headers || {}).forEach(([key, value]) => {
            if (value != null && !SKIP_HEADERS.has(key.toLowerCase())) headers[key] = value;
        });
        headers['x-internal-service-token'] = token;
        headers['x-internal-service-name'] = 'googer-admin';
        const hasBody = !['GET', 'HEAD'].includes(req.method);
        const upstream = await fetch(`${mainBase()}${req.originalUrl}`, {
            method: req.method,
            headers,
            body: hasBody ? req : undefined,
            duplex: hasBody ? 'half' : undefined,
        });
        res.status(upstream.status);
        upstream.headers.forEach((value, key) => {
            if (!SKIP_HEADERS.has(key.toLowerCase()) && key.toLowerCase() !== 'content-encoding') res.setHeader(key, value);
        });
        if (!upstream.body) return res.end();
        Readable.fromWeb(upstream.body).pipe(res);
    } catch (error) {
        console.error('[chat-features] forward failed:', error.message);
        res.status(502).json({ success: false, message: 'Could not reach the main server.' });
    }
};

module.exports = [authMiddleware, adminOnly, forward];
