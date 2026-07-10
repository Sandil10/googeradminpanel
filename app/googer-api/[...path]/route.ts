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

const MAIN_BACKEND_FALLBACKS = [
    'http://127.0.0.1:5000',
    'http://localhost:5000',
    'http://main-backend:5000',
];

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    const pathStr = Array.isArray(path) ? path.join('/') : path;
    const search = request.nextUrl.search || '';
    const resolvedBackend = resolveRemoteServiceUrl({
        envVar: 'GOOGER_MAIN_API_URL',
        // Match the Next rewrite fallback used by the admin app in local/recovery
        // environments, then keep the Docker hostname as a later fallback.
        fallbackUrl: process.env.MAIN_BACKEND_URL || MAIN_BACKEND_FALLBACKS[0],
        serviceName: 'googer-main-api',
        reason: 'admin googer-api proxy',
    });
    const backendCandidates = Array.from(
        new Set(
            [
                resolvedBackend,
                process.env.GOOGER_MAIN_API_URL,
                process.env.MAIN_BACKEND_URL,
                ...MAIN_BACKEND_FALLBACKS,
            ]
                .map((value) => String(value || '').trim().replace(/\/+$/, ''))
                .filter(Boolean),
        ),
    );

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

    let lastError: any = null;

    for (const backend of backendCandidates) {
        const targetPath = pathStr.startsWith('uploads/')
            ? `/${pathStr}`
            : `/api/${pathStr}`;
        const targetUrl = `${backend}${targetPath}${search}`;
        try {
            const upstream = await fetch(targetUrl, {
                method,
                headers: forwardHeaders,
                body: hasBody && body ? body : undefined,
            });

            const responseBody = await upstream.arrayBuffer();
            const responseHeaders: Record<string, string> = {};
            upstream.headers.forEach((value, key) => {
                if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) {
                    responseHeaders[key] = value;
                }
            });

            responseHeaders['x-googer-api-upstream'] = backend;

            return new NextResponse(responseBody, {
                status: upstream.status,
                statusText: upstream.statusText,
                headers: responseHeaders,
            });
        } catch (err: any) {
            lastError = err;
            console.error(`[Googer API Proxy] Failed to reach ${targetUrl}:`, err.message);
        }
    }

    return NextResponse.json(
        {
            message: `Main backend unreachable. Tried: ${backendCandidates.join(', ')}`,
            detail: lastError?.message || 'Unknown proxy error',
        },
        { status: 503 },
    );
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
