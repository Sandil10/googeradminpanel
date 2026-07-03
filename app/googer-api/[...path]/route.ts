/**
 * Catch-all proxy route for the main Googer backend.
 * This keeps /googer-api/* working even when rewrites are skipped by the App Router runtime.
 */
import { NextRequest, NextResponse } from 'next/server';
import { resolveRemoteServiceUrl } from '../../../shared/runtime/serviceContractPolicy';

const DROP_REQUEST_HEADERS = new Set([
    'host', 'connection', 'transfer-encoding', 'keep-alive',
    'upgrade', 'proxy-authorization', 'content-encoding',
    'origin', 'referer',
]);

const DROP_RESPONSE_HEADERS = new Set([
    'transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length',
]);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    const pathStr = Array.isArray(path) ? path.join('/') : path;
    const search = request.nextUrl.search || '';
    const backend = resolveRemoteServiceUrl({
        envVar: 'GOOGER_MAIN_API_URL',
        // Use the Docker service name as the final fallback so this still works
        // when the App Router runtime can't see the injected env var.
        fallbackUrl: process.env.MAIN_BACKEND_URL || 'http://main-backend:5000',
        serviceName: 'googer-main-api',
        reason: 'admin googer-api proxy',
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
        console.error(`[Googer API Proxy] Failed to reach ${targetUrl}:`, err.message);
        return NextResponse.json(
            { message: `Main backend unreachable. Is the Express server running at ${backend}?` },
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
