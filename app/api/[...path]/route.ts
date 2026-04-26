/**
 * Catch-all API proxy route.
 * Next.js App Router intercepts all /api/* before rewrites run,
 * so we forward everything to the Express backend on port 5000.
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    const pathStr = Array.isArray(path) ? path.join('/') : path;
    const search = request.nextUrl.search || '';
    const targetUrl = `${BACKEND}/api/${pathStr}${search}`;

    // Build forwarded headers — drop hop-by-hop headers
    const forwardHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (!['host', 'connection', 'transfer-encoding', 'keep-alive', 'upgrade', 'proxy-authorization'].includes(lower)) {
            forwardHeaders[key] = value;
        }
    });

    const method = request.method.toUpperCase();
    const hasBody = !['GET', 'HEAD', 'DELETE', 'OPTIONS'].includes(method);

    let bodyInit: BodyInit | undefined;
    if (hasBody) {
        // Read body as ArrayBuffer to avoid streaming issues
        try {
            bodyInit = await request.arrayBuffer();
        } catch {
            bodyInit = undefined;
        }
    }

    try {
        const upstream = await fetch(targetUrl, {
            method,
            headers: forwardHeaders,
            body: hasBody && bodyInit ? bodyInit : undefined,
        });

        // Read response as buffer
        const responseBody = await upstream.arrayBuffer();

        const responseHeaders: Record<string, string> = {};
        upstream.headers.forEach((value, key) => {
            const lower = key.toLowerCase();
            if (!['transfer-encoding', 'connection', 'keep-alive'].includes(lower)) {
                responseHeaders[key] = value;
            }
        });

        return new NextResponse(responseBody, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: responseHeaders,
        });
    } catch (err: any) {
        console.error(`[API Proxy] Failed to reach ${targetUrl}:`, err.message);
        return NextResponse.json(
            { message: 'Backend unreachable. Make sure the Express server is running on port 5000.' },
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
