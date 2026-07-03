const fs = require('fs');
const os = require('os');
const path = require('path');

const AUDIT_LOG_DIR = path.resolve(__dirname, '..', 'logs');
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, 'admin-audit.log');

function getRequestIp(req) {
    const forwarded = req?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req?.ip || req?.socket?.remoteAddress || null;
}

async function writeAdminAuditEvent(req, event = {}) {
    const payload = {
        timestamp: new Date().toISOString(),
        action: event.action || 'unknown',
        status: event.status || 'success',
        actor: req?.user ? {
            id: req.user.id || req.user.userId || null,
            username: req.user.username || null,
            role: req.user.user_type || req.user.role || null,
        } : null,
        internalService: req?.internalService ? {
            name: req.internalService.name || 'internal-service',
        } : null,
        request: {
            method: req?.method || null,
            path: req?.originalUrl || req?.url || null,
            ip: getRequestIp(req || {}),
        },
        target: event.target || null,
        amount: event.amount ?? null,
        details: event.details || null,
        error: event.error || null,
    };

    await fs.promises.mkdir(AUDIT_LOG_DIR, { recursive: true });
    await fs.promises.appendFile(AUDIT_LOG_FILE, `${JSON.stringify(payload)}${os.EOL}`, 'utf8');
}

module.exports = {
    AUDIT_LOG_FILE,
    writeAdminAuditEvent,
};
