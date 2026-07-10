import { NextRequest, NextResponse } from "next/server";

const MAIN_BACKEND_FALLBACKS = [
    "http://127.0.0.1:5000",
    "http://localhost:5000",
];

const DROP_RESPONSE_HEADERS = new Set([
    "transfer-encoding",
    "connection",
    "keep-alive",
    "content-encoding",
    "content-length",
]);

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    const pathStr = Array.isArray(path) ? path.join("/") : "";
    const search = request.nextUrl.search || "";
    const backendCandidates = Array.from(
        new Set(
            [
                process.env.GOOGER_MAIN_API_URL,
                process.env.MAIN_BACKEND_URL,
                ...MAIN_BACKEND_FALLBACKS,
            ]
                .map((value) => String(value || "").trim().replace(/\/+$/, ""))
                .filter(Boolean),
        ),
    );

    for (const backend of backendCandidates) {
        const targetUrl = `${backend}/uploads/${pathStr}${search}`;
        try {
            const upstream = await fetch(targetUrl, { cache: "no-store" });
            const body = await upstream.arrayBuffer();
            const headers: Record<string, string> = {};

            upstream.headers.forEach((value, key) => {
                if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) {
                    headers[key] = value;
                }
            });

            headers["x-googer-media-upstream"] = backend;

            return new NextResponse(body, {
                status: upstream.status,
                statusText: upstream.statusText,
                headers,
            });
        } catch {
            // Try the next local backend candidate.
        }
    }

    return NextResponse.json({ message: "Media file unavailable" }, { status: 404 });
}

export const HEAD = GET;
