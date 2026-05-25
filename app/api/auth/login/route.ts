import { NextRequest, NextResponse } from 'next/server';

const BACKEND = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const upstream = await fetch(`${BACKEND}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await upstream.json();
        return NextResponse.json(data, { status: upstream.status });
    } catch (err: any) {
        console.error('[Login Route]', err.message);
        return NextResponse.json(
            { success: false, message: 'Cannot connect to server. Make sure the backend is running.' },
            { status: 503 }
        );
    }
}
