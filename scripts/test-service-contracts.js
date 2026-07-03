const assert = require('assert');
const http = require('http');
const express = require('express');
const {
    resolveRemoteServiceUrl,
} = require('../shared/runtime/serviceContractPolicy');
const { createRouteServiceProxy } = require('../shared/http/routeServiceProxy');

const startServer = (listener) => new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        resolve({
            port: address.port,
            server,
        });
    });
});

const stopServer = (server) => new Promise((resolve) => {
    if (!server || !server.listening) {
        resolve();
        return;
    }

    server.close(() => resolve());
});

const requestJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    return {
        body,
        status: response.status,
    };
};

const withEnv = async (overrides, callback) => {
    const previous = {};
    Object.keys(overrides).forEach((key) => {
        previous[key] = process.env[key];
        const value = overrides[key];
        if (value === undefined || value === null) {
            delete process.env[key];
        } else {
            process.env[key] = String(value);
        }
    });

    try {
        return await callback();
    } finally {
        Object.keys(overrides).forEach((key) => {
            const value = previous[key];
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        });
    }
};

const expectContractError = async (label, callback) => {
    let threw = false;
    try {
        await callback();
    } catch (error) {
        threw = true;
        assert.strictEqual(error.code, 'REMOTE_SERVICE_CONTRACT_REQUIRED', `${label} should require remote service contract`);
    }
    assert.strictEqual(threw, true, `${label} should throw`);
};

const runStrictContractChecks = async () => {
    await withEnv({
        STRICT_SERVICE_CONTRACTS: '1',
        BACKEND_URL: '',
        GOOGER_MAIN_API_URL: '',
    }, async () => {
        await expectContractError('admin app proxy backend contract', async () => {
            resolveRemoteServiceUrl({
                envVar: 'BACKEND_URL',
                fallbackUrl: 'http://localhost:3002',
                serviceName: 'googer-admin-api',
                reason: 'admin app api proxy',
            });
        });

        await expectContractError('main googer proxy contract', async () => {
            resolveRemoteServiceUrl({
                envVar: 'GOOGER_MAIN_API_URL',
                fallbackUrl: 'http://localhost:5000',
                serviceName: 'googer-main-api',
                reason: 'admin googer-api proxy',
            });
        });
    });
};

const runRouteOwnershipChecks = async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/users', createRouteServiceProxy({
        envVar: 'GOOGER_MAIN_API_URL',
        serviceName: 'googer-main-admin-domain',
    }));
    app.get('/api/users/all', (req, res) => {
        res.json({ local: true });
    });

    const proxyServer = await startServer(app);
    try {
        await withEnv({
            STRICT_ROUTE_SERVICE_OWNERSHIP: '1',
            GOOGER_MAIN_API_URL: '',
        }, async () => {
            const result = await requestJson(`http://127.0.0.1:${proxyServer.port}/api/users/all`);
            assert.strictEqual(result.status, 503);
            assert.strictEqual(result.body.code, 'REMOTE_SERVICE_CONTRACT_REQUIRED');
        });

        const upstream = await startServer((req, res) => {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                proxied: true,
                path: req.url,
                marker: req.headers['x-googer-proxy-service'] || null,
            }));
        });

        try {
            await withEnv({
                STRICT_ROUTE_SERVICE_OWNERSHIP: '1',
                GOOGER_MAIN_API_URL: `http://127.0.0.1:${upstream.port}`,
            }, async () => {
                const result = await requestJson(`http://127.0.0.1:${proxyServer.port}/api/users/all`);
                assert.strictEqual(result.status, 200);
                assert.strictEqual(result.body.proxied, true);
                assert.strictEqual(result.body.path, '/api/users/all');
                assert.strictEqual(result.body.marker, 'googer-main-admin-domain');
            });
        } finally {
            await stopServer(upstream.server);
        }
    } finally {
        await stopServer(proxyServer.server);
    }
};

const run = async () => {
    await runStrictContractChecks();
    await runRouteOwnershipChecks();
    console.log('admin service contract enforcement checks ok');
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
