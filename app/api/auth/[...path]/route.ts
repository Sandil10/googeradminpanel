import { NextRequest, NextResponse } from 'next/server';

const BACKEND = (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

const DROP_REQUEST_HEADERS = new Set([
    'host',
    'connection',
    'transfer-encoding',
    'keep-alive',
    'upgrade',
    'proxy-authorization',
    'content-encoding',
    'origin',
    'referer',
]);

const DROP_RESPONSE_HEADERS = new Set([
    'transfer-encoding',
    'connection',
    'keep-alive',
    'content-encoding',
    'content-length',
]);

const normalizeRole = (value: unknown) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');

const isAdminRole = (value: unknown) => {
    const normalized = normalizeRole(value);
    return ['admin', 'super_admin', 'superadmin', 'employee', 'administrator'].includes(normalized);
};

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    const pathStr = Array.isArray(path) ? path.join('/') : path;
    const targetUrl = `${BACKEND}/api/auth/${pathStr}${request.nextUrl.search || ''}`;

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
        try {
            body = await request.text();
        } catch {
            body = undefined;
        }
    }

    try {
        const upstream = await fetch(targetUrl, {
            method,
            headers: forwardHeaders,
            body: hasBody && body ? body : undefined,
        });

        const responseText = await upstream.text();
        let parsed: any = null;
        try {
            parsed = responseText ? JSON.parse(responseText) : null;
        } catch {}

        if (pathStr === 'login' && upstream.ok && !isAdminRole(parsed?.user?.user_type)) {
            return NextResponse.json(
                { success: false, message: 'Access denied. Only admin accounts can log in here.' },
                { status: 403 },
            );
        }

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
        console.error(`[Auth API Proxy] Failed to reach ${targetUrl}:`, err.message);
        return NextResponse.json(
            { success: false, message: `Cannot connect to server. Make sure the backend is running at ${BACKEND}.` },
            { status: 503 },
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
