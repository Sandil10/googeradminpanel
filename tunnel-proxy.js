/**
 * tunnel-proxy.js
 * Sits between Cloudflare tunnel and Next.js dev server.
 * Rewrites the Host header to "localhost:3000" so Next.js
 * accepts requests from any trycloudflare.com URL.
 *
 * Usage:
 *   node tunnel-proxy.js
 * Then tunnel to port 4000:
 *   npx cloudflared tunnel --url http://localhost:4000
 */

const http = require('http');

const PROXY_PORT = 4000;
const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 3000;

const server = http.createServer((clientReq, clientRes) => {
    const options = {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: clientReq.url,
        method: clientReq.method,
        headers: {
            ...clientReq.headers,
            host: `localhost:${TARGET_PORT}`,
        },
    };

    const proxyReq = http.request(options, (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err.message);
        if (!clientRes.headersSent) {
            clientRes.writeHead(502);
            clientRes.end('Next.js is not running on port 3000');
        }
    });

    clientReq.pipe(proxyReq, { end: true });
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
    console.log(`Tunnel proxy ready on port ${PROXY_PORT} → Next.js :${TARGET_PORT}`);
});
