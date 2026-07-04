const { Readable } = require('node:stream');
const {
    createMissingContractError,
    getRemoteServiceUrl,
    isStrictRouteOwnershipModeEnabled,
} = require('../runtime/serviceContractPolicy');

const HOP_BY_HOP_HEADERS = new Set([
    'connection',
    'content-length',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);

const copyHeaders = (headers) => {
    const forwarded = {};
    Object.entries(headers || {}).forEach(([key, value]) => {
        if (value == null) return;
        if (HOP_BY_HOP_HEADERS.has(String(key).toLowerCase())) return;
        forwarded[key] = value;
    });
    return forwarded;
};

const createRouteServiceProxy = ({
    envVar,
    serviceName,
} = {}) => async (req, res, next) => {
    const baseUrl = getRemoteServiceUrl(envVar);
    if (!baseUrl) {
        if (isStrictRouteOwnershipModeEnabled()) {
            const error = createMissingContractError({
                envVar,
                serviceName,
                reason: `route ownership for ${req.originalUrl || req.url}`,
            });
            return res.status(error.statusCode || 503).json({
                success: false,
                message: error.message,
                code: error.code,
                service: serviceName,
            });
        }

        return next();
    }

    try {
        const headers = copyHeaders(req.headers);
        headers['x-forwarded-host'] = req.headers.host || '';
        headers['x-forwarded-proto'] = req.protocol || 'http';
        headers['x-forwarded-for'] = req.ip || '';
        headers['x-googer-proxy-service'] = serviceName;

        const hasBody = !['GET', 'HEAD'].includes(req.method);
        const upstream = await fetch(`${baseUrl}${req.originalUrl}`, {
            method: req.method,
            headers,
            body: hasBody ? req : undefined,
            duplex: hasBody ? 'half' : undefined,
            redirect: 'manual',
        });

        res.status(upstream.status);
        upstream.headers.forEach((value, key) => {
            if (HOP_BY_HOP_HEADERS.has(String(key).toLowerCase())) return;
            res.setHeader(key, value);
        });

        if (!upstream.body) {
            res.end();
            return;
        }

        Readable.fromWeb(upstream.body).pipe(res);
    } catch (error) {
        console.error(`[proxy:${serviceName}]`, error.message);
        next(error);
    }
};

module.exports = {
    createRouteServiceProxy,
};
