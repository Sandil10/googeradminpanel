"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import IonIcon from "../../components/IonIcon";
import { adminService } from "../../services/adminService";

type TrafficUser = {
    userId: number;
    username?: string | null;
    fullName?: string | null;
    userType?: string | null;
    lastSeenAt?: string | null;
    secondsAgo: number;
    status: "active" | "online" | "idle";
};

type TrafficAnalysis = {
    generatedAt: string;
    windowSeconds: number;
    activeConcurrentUsers: number;
    onlineUsers: number;
    idleUsers: number;
    dailyActiveUsers: number;
    totalTrackedUsers: number;
    latestSeenAt?: string | null;
    requestsPerSecond: number;
    recentUsers: TrafficUser[];
    note?: string;
};

function formatSeconds(seconds?: number) {
    const value = Number(seconds || 0);
    if (value < 5) return "now";
    if (value < 60) return `${value}s ago`;
    const minutes = Math.floor(value / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
}

function statusClass(status: TrafficUser["status"]) {
    if (status === "active") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-300";
    if (status === "online") return "border-cyan-400/25 bg-cyan-500/10 text-cyan-300";
    return "border-amber-400/25 bg-amber-500/10 text-amber-300";
}

export default function TrafficAnalysisPage() {
    const [data, setData] = useState<TrafficAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadTraffic = useCallback(async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const nextData = await adminService.fetchTrafficAnalysis();
            setData(nextData);
            setError(null);
        } catch (err: any) {
            setError(err?.message || "Failed to load traffic analysis");
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadTraffic(false);
        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") void loadTraffic(true);
        }, 2000);
        return () => window.clearInterval(interval);
    }, [loadTraffic]);

    const freshness = useMemo(() => {
        if (!data?.generatedAt) return "waiting";
        return formatSeconds(Math.max(0, Math.floor((Date.now() - new Date(data.generatedAt).getTime()) / 1000)));
    }, [data?.generatedAt]);

    const cards = [
        { label: "Live Concurrent Users", value: data?.activeConcurrentUsers ?? 0, icon: "radio", tone: "from-emerald-500/20 to-cyan-500/10", detail: `${data?.windowSeconds || 20}s live window` },
        { label: "Online Right Now", value: data?.onlineUsers ?? 0, icon: "people", tone: "from-cyan-500/20 to-blue-500/10", detail: "seen within 60 seconds" },
        { label: "Idle Nearby", value: data?.idleUsers ?? 0, icon: "time", tone: "from-amber-500/20 to-orange-500/10", detail: "seen within 5 minutes" },
        { label: "Daily Active", value: data?.dailyActiveUsers ?? 0, icon: "calendar", tone: "from-fuchsia-500/20 to-rose-500/10", detail: "tracked today" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-[#09090b] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300">Monitoring Only</p>
                    <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">Traffic Analysis</h1>
                    <p className="mt-1 max-w-2xl text-sm text-white/45">Live concurrent users are counted from fresh main-app activity heartbeats.</p>
                </div>
                <button
                    type="button"
                    onClick={() => loadTraffic(false)}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-black transition hover:bg-zinc-200 disabled:opacity-50"
                >
                    <IonIcon name={loading ? "sync" : "refresh"} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => (
                    <div key={card.label} className={`rounded-[1.75rem] border border-white/10 bg-gradient-to-br ${card.tone} p-5`}>
                        <div className="flex items-center justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xl text-white">
                                <IonIcon name={`${card.icon}-outline`} />
                            </div>
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">Live</span>
                        </div>
                        <div className="mt-5 text-4xl font-black tabular-nums text-white">{card.value}</div>
                        <div className="mt-1 text-sm font-bold text-white/80">{card.label}</div>
                        <div className="mt-1 text-xs text-white/40">{card.detail}</div>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[2rem] border border-white/10 bg-[#09090b] p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-black text-white">Realtime Signal</h2>
                            <p className="text-xs text-white/40">Updated {freshness}. Estimated requests/sec: {data?.requestsPerSecond ?? 0}</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                            Streaming
                        </div>
                    </div>
                    <div className="h-48 overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4">
                        <div className="flex h-full items-end gap-2">
                            {Array.from({ length: 24 }).map((_, index) => {
                                const active = data?.activeConcurrentUsers || 0;
                                const online = data?.onlineUsers || 0;
                                const height = Math.max(8, Math.min(100, (active * 18 + online * 8 + ((index * 13) % 18))));
                                return <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-emerald-600/70 to-cyan-300/80 transition-all" style={{ height: `${height}%` }} />;
                            })}
                        </div>
                    </div>
                    {data?.note && <p className="mt-3 text-xs text-amber-300/80">{data.note}</p>}
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-[#09090b] p-6">
                    <h2 className="text-lg font-black text-white">Recent Active Users</h2>
                    <p className="mt-1 text-xs text-white/40">Most recent heartbeat records from the main app.</p>
                    <div className="mt-5 space-y-3">
                        {(data?.recentUsers || []).length === 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center text-sm text-white/40">No active users detected yet.</div>
                        ) : data!.recentUsers.map((user) => (
                            <div key={`${user.userId}-${user.lastSeenAt}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-white">
                                    {(user.fullName || user.username || "U").slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-bold text-white">{user.fullName || user.username || `User ${user.userId}`}</div>
                                    <div className="truncate text-[11px] text-white/35">@{user.username || "unknown"} {user.userType ? `- ${user.userType}` : ""}</div>
                                </div>
                                <div className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${statusClass(user.status)}`}>{formatSeconds(user.secondsAgo)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
