import { NextRequest, NextResponse } from 'next/server';

const BACKEND = (process.env.BACKEND_URL || 'http://localhost:3002').replace(/\/$/, '');

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const upstream = await fetch(`${BACKEND}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await upstream.json();

        // Only superadmin accounts can access the admin panel
        if (upstream.ok && data?.user?.user_type !== 'superadmin') {
            return NextResponse.json(
                { success: false, message: 'Access denied. Only super admin accounts can log in here.' },
                { status: 403 }
            );
        }

        return NextResponse.json(data, { status: upstream.status });
    } catch (err: any) {
        console.error('[Login Route]', err.message);
        return NextResponse.json(
            { success: false, message: `Cannot connect to server. Make sure the backend is running at ${BACKEND}.` },
            { status: 503 }
        );
    }
}
