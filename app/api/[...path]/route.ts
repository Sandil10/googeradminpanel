/**
 * Catch-all API proxy route.
 * Next.js App Router intercepts all /api/* before rewrites run,
 * so we forward everything to the configured Express backend.
 */
import { NextRequest, NextResponse } from 'next/server';
import { resolveRemoteServiceUrl } from '../../../shared/runtime/serviceContractPolicy';

// Headers that must not be forwarded (hop-by-hop + encoding that fetch auto-handles)
// Drop 'origin' and 'referer' so Express CORS never sees the browser's ngrok/external origin.
// All requests through this proxy are server-to-server; the browser's origin is irrelevant.
const DROP_REQUEST_HEADERS = new Set([
    'host', 'connection', 'transfer-encoding', 'keep-alive',
    'upgrade', 'proxy-authorization', 'content-encoding',
    'origin', 'referer',
]);

// fetch() auto-decodes content-encoding (gzip/br), so forwarding it would
// make the browser try to decode already-decoded bytes → garbled JSON.
const DROP_RESPONSE_HEADERS = new Set([
    'transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length',
]);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    const pathStr = Array.isArray(path) ? path.join('/') : path;
    const search = request.nextUrl.search || '';
    const backend = resolveRemoteServiceUrl({
        envVar: 'BACKEND_URL',
        fallbackUrl: 'http://localhost:3002',
        serviceName: 'googer-admin-api',
        reason: 'admin app api proxy',
    });
    const targetUrl = `${backend}/api/${pathStr}${search}`;

    const forwardHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        if (!DROP_REQUEST_HEADERS.has(key.toLowerCase())) {
            forwardHeaders[key] = value;
        }
    });

    const method = request.method.toUpperCase();
    const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method);

    let body: string | undefined;
    if (hasBody) {
        try { body = await request.text(); } catch { body = undefined; }
    }

    try {
        const upstream = await fetch(targetUrl, {
            method,
            headers: forwardHeaders,
            body: hasBody && body ? body : undefined,
        });

        // fetch() has already decoded the body; read as text to get the real bytes
        const responseText = await upstream.text();

        const responseHeaders: Record<string, string> = {};
        upstream.headers.forEach((value, key) => {
            if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) {
                responseHeaders[key] = value;
            }
        });

        return new NextResponse(responseText, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: responseHeaders,
        });
    } catch (err: any) {
        console.error(`[API Proxy] Failed to reach ${targetUrl}:`, err.message);
        return NextResponse.json(
            { message: `Backend unreachable. Is the Express server running at ${backend}?` },
            { status: 503 }
        );
    }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
