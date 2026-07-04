"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import IonIcon from "../../components/IonIcon";
import { adminService } from "../../services/adminService";

export type TrafficAnalysisSection = "overview" | "live" | "forecast";

type ChartPoint = {
    label: string;
    value: number;
};

type TrafficUser = {
    userId: number;
    username?: string | null;
    fullName?: string | null;
    userType?: string | null;
    lastSeenAt?: string | null;
    secondsAgo?: number;
    status?: "active" | "online" | "idle";
};

type TrafficAnalysisPayload = {
    success?: boolean;
    generatedAt?: string;
    overview?: any;
    liveTraffic?: any;
    performance?: any;
    scalability?: any;
    forecast?: any;
    widgets?: Record<string, ChartPoint[]>;
    alerts?: {
        items?: Array<{ severity?: string; title?: string; message?: string }>;
        recommendations?: string[];
    };
    recentUsers?: TrafficUser[];
    note?: string;
};

function numberValue(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: unknown, digits = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "0";
    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits ? Math.min(digits, 2) : 0,
    }).format(parsed);
}

function formatPercent(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "0%";
    return `${formatNumber(parsed, parsed % 1 ? 1 : 0)}%`;
}

function formatMs(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return "0ms";
    if (parsed >= 1000) return `${formatNumber(parsed / 1000, 2)}s`;
    return `${formatNumber(parsed)}ms`;
}

function formatBytes(value: unknown) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${formatNumber(bytes / Math.pow(1024, index), index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTimeAgo(value?: string | null) {
    if (!value) return "waiting";
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 5) return "now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
}

function healthTone(value?: string) {
    const normalized = String(value || "").toLowerCase();
    if (normalized.includes("critical") || normalized.includes("down") || normalized.includes("offline")) {
        return "border-rose-500/25 bg-rose-500/10 text-rose-200";
    }
    if (normalized.includes("warn") || normalized.includes("degraded")) {
        return "border-amber-500/25 bg-amber-500/10 text-amber-100";
    }
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
}

function severityTone(severity?: string) {
    if (severity === "critical") return "border-rose-500/25 bg-rose-500/10 text-rose-200";
    if (severity === "warning") return "border-amber-500/25 bg-amber-500/10 text-amber-100";
    return "border-cyan-500/25 bg-cyan-500/10 text-cyan-100";
}

function MiniBarChart({
    title,
    subtitle,
    data,
    accentClass,
}: {
    title: string;
    subtitle: string;
    data: ChartPoint[];
    accentClass: string;
}) {
    const points = data.length ? data : [{ label: "now", value: 0 }];
    const max = Math.max(...points.map((point) => numberValue(point.value)), 1);

    return (
        <div className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-5">
            <div className="mb-5">
                <h3 className="text-base font-bold text-white">{title}</h3>
                <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            </div>
            <div className="flex h-44 items-end gap-2">
                {points.map((point, index) => {
                    const height = Math.max((numberValue(point.value) / max) * 100, numberValue(point.value) > 0 ? 8 : 2);
                    return (
                        <div key={`${point.label}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                            <div className="flex h-full w-full items-end">
                                <div
                                    className={`w-full rounded-t-2xl ${accentClass}`}
                                    style={{ height: `${height}%` }}
                                    title={`${point.label}: ${point.value}`}
                                />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                                {point.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function TrafficAnalysisView({ section }: { section: TrafficAnalysisSection }) {
    const [analysis, setAnalysis] = useState<TrafficAnalysisPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadAnalysis = useCallback(async (isRefresh = false) => {
        try {
            setError(null);
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            const result = await adminService.fetchTrafficAnalysis();
            setAnalysis(result);
        } catch (err: any) {
            setError(err?.message || "Failed to load traffic analysis");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void loadAnalysis(false);
        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") void loadAnalysis(true);
        }, 30000);
        return () => window.clearInterval(interval);
    }, [loadAnalysis]);

    const overview = analysis?.overview || {};
    const liveTraffic = analysis?.liveTraffic || {};
    const performance = analysis?.performance || {};
    const scalability = analysis?.scalability || {};
    const forecast = analysis?.forecast || {};
    const widgets = analysis?.widgets || {};
    const alerts = analysis?.alerts?.items || [];
    const recommendations = analysis?.alerts?.recommendations || [];
    const recentUsers = analysis?.recentUsers || liveTraffic.recentUsers || [];
    const server = overview.server || {};
    const database = overview.database || {};
    const storage = overview.storage || {};

    const headlineCards = useMemo(() => ([
        {
            title: "Live Concurrent Users",
            value: formatNumber(liveTraffic.activeConcurrentUsers),
            detail: `${formatNumber(liveTraffic.onlineUsers)} online right now`,
            icon: "people-outline",
            tone: "text-cyan-300 border-cyan-500/20 bg-cyan-500/10",
        },
        {
            title: "Daily Active Users",
            value: formatNumber(liveTraffic.dailyActiveUsers),
            detail: `${formatNumber(liveTraffic.monthlyActiveUsers)} monthly active`,
            icon: "pulse-outline",
            tone: "text-blue-300 border-blue-500/20 bg-blue-500/10",
        },
        {
            title: "Requests Per Second",
            value: formatNumber(liveTraffic.requestsPerSecond, 2),
            detail: `${formatMs(liveTraffic.apiResponseTimes?.averageMs)} average response`,
            icon: "flash-outline",
            tone: "text-violet-300 border-violet-500/20 bg-violet-500/10",
        },
        {
            title: "Estimated Capacity",
            value: formatNumber(scalability.estimatedMaximumConcurrentUsers),
            detail: `${formatPercent(scalability.currentUtilizationPercent)} utilized`,
            icon: "bar-chart-outline",
            tone: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10",
        },
    ]), [liveTraffic, scalability]);

    const tabs: Array<{ key: TrafficAnalysisSection; label: string; href: string; icon: string; detail: string }> = [
        { key: "overview", label: "Overview", href: "/admin/traffic-analysis/overview", icon: "albums-outline", detail: "Infrastructure and health" },
        { key: "live", label: "Live Monitor", href: "/admin/traffic-analysis/live", icon: "pulse-outline", detail: "Traffic and performance" },
        { key: "forecast", label: "Forecast & Scale", href: "/admin/traffic-analysis/forecast", icon: "trending-up-outline", detail: "Prediction and actions" },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
                        <IonIcon name="shield-checkmark-outline" className="text-xs" />
                        Monitoring Only
                    </div>
                    <h1 className="text-2xl font-bold text-white md:text-3xl">Traffic Analysis</h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-400">
                        Real-time operational analytics, forecasts, and scaling guidance. Sensitive implementation details stay hidden.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">
                        Updated {formatTimeAgo(analysis?.generatedAt)}
                    </span>
                    <button
                        onClick={() => void loadAnalysis(true)}
                        disabled={loading || refreshing}
                        className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                        <IonIcon name={refreshing ? "sync" : "refresh-outline"} className={refreshing ? "animate-spin text-sm" : "text-sm"} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {tabs.map((tab) => {
                    const isActive = tab.key === section;
                    return (
                        <Link
                            key={tab.key}
                            href={tab.href}
                            className={`rounded-3xl border p-4 transition ${
                                isActive
                                    ? "border-cyan-500/30 bg-cyan-500/10 text-white"
                                    : "border-[#1a1a1a] bg-[#09090b] text-slate-300 hover:border-white/10 hover:bg-white/[0.03]"
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                                    isActive ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" : "border-white/10 bg-white/5 text-slate-400"
                                }`}>
                                    <IonIcon name={tab.icon} className="text-lg" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">{tab.label}</p>
                                    <p className="mt-1 text-xs text-slate-500">{tab.detail}</p>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {headlineCards.map((card) => (
                    <div key={card.title} className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-5">
                        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border ${card.tone}`}>
                            <IonIcon name={card.icon} className="text-xl" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{card.title}</p>
                        <div className="mt-2 text-3xl font-bold text-white">{loading ? "..." : card.value}</div>
                        <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
                    </div>
                ))}
            </div>

            {section === "overview" && (
                <>
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                        <div className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-6 xl:col-span-2">
                            <div className="mb-6 flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white">Current Infrastructure Overview</h2>
                                    <p className="mt-1 text-xs text-slate-500">Hosting, compute, database, storage, and runtime utilization.</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    {overview.topology || "single-server"}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {[
                                    ["Hosting", overview.hostingEnvironment || "Detected server", `Topology: ${overview.topology || "single-server"}`],
                                    ["CPU", `${formatNumber(server.cpuCores || 1)} cores`, `Usage: ${formatPercent(server.cpuUsagePercent)}`],
                                    ["Memory", `${formatBytes(server.usedMemoryBytes)} / ${formatBytes(server.totalMemoryBytes)}`, `Usage: ${formatPercent(server.memoryUsagePercent)}`],
                                    ["Disk", `${formatBytes(server.disk?.usedBytes)} / ${formatBytes(server.disk?.totalBytes)}`, `Usage: ${formatPercent(server.disk?.usagePercent)}`],
                                    ["Database", `${formatNumber(database.activeConnections)} / ${formatNumber(database.totalSessions)} sessions`, `Size: ${formatBytes(database.sizeBytes)}`],
                                    ["Storage", formatBytes(storage.localUploadBytes), overview.objectStorageConfigured ? "Object storage configured" : "Local/media storage signal"],
                                ].map(([label, value, detail]) => (
                                    <div key={label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">{label}</p>
                                        <p className="mt-3 text-lg font-bold text-white">{value}</p>
                                        <p className="mt-1 text-xs text-slate-500">{detail}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-6">
                            <h2 className="text-lg font-bold text-white">Health Status</h2>
                            <p className="mt-1 text-xs text-slate-500">Operational status from current server signals.</p>
                            <div className="mt-5 space-y-3">
                                {(performance.health || []).map((item: any) => (
                                    <div key={item.label} className={`rounded-2xl border px-4 py-3 ${healthTone(item.status)}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-bold">{item.label}</span>
                                            <span className="text-[10px] font-black uppercase tracking-[0.18em]">{item.status}</span>
                                        </div>
                                        <p className="mt-1 text-xs opacity-75">{item.detail}</p>
                                    </div>
                                ))}
                            </div>
                            {analysis?.note && <p className="mt-4 text-xs text-amber-300">{analysis.note}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                        <MiniBarChart title="CPU" subtitle="Current utilization signal" data={widgets.cpu || []} accentClass="bg-cyan-400/80" />
                        <MiniBarChart title="Memory" subtitle="Memory pressure signal" data={widgets.memory || []} accentClass="bg-blue-400/80" />
                        <MiniBarChart title="Traffic Forecast" subtitle="Projected concurrent users" data={widgets.trafficForecast || []} accentClass="bg-emerald-400/80" />
                    </div>
                </>
            )}

            {section === "live" && (
                <>
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <div className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-6">
                            <h2 className="text-lg font-bold text-white">Live Traffic Monitoring</h2>
                            <p className="mt-1 text-xs text-slate-500">Realtime user presence, request rate, and bandwidth estimate.</p>
                            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {[
                                    ["Online users", formatNumber(liveTraffic.onlineUsers), "last 60 seconds"],
                                    ["Socket users", formatNumber(liveTraffic.connectedSocketUsers), "active socket signal"],
                                    ["Bandwidth", `${formatBytes(liveTraffic.bandwidth?.ingressBytes)} in / ${formatBytes(liveTraffic.bandwidth?.egressBytes)} out`, "network device snapshot"],
                                    ["Activity window", `${formatNumber(liveTraffic.activityWindowMs)}ms`, "app activity window"],
                                ].map(([label, value, detail]) => (
                                    <div key={label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">{label}</p>
                                        <p className="mt-3 text-xl font-bold text-white">{value}</p>
                                        <p className="mt-1 text-xs text-slate-500">{detail}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-6">
                            <h2 className="text-lg font-bold text-white">Recent Active Users</h2>
                            <p className="mt-1 text-xs text-slate-500">Most recent dashboard heartbeat records from the main app.</p>
                            <div className="mt-5 space-y-3">
                                {recentUsers.length === 0 ? (
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center text-sm text-white/40">
                                        No active users detected yet.
                                    </div>
                                ) : recentUsers.slice(0, 8).map((user: TrafficUser) => (
                                    <div key={`${user.userId}-${user.lastSeenAt}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-white">
                                            {(user.fullName || user.username || "U").slice(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-bold text-white">{user.fullName || user.username || `User ${user.userId}`}</div>
                                            <div className="truncate text-[11px] text-white/35">@{user.username || "unknown"} {user.userType ? `- ${user.userType}` : ""}</div>
                                        </div>
                                        <div className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${healthTone(user.status)}`}>
                                            {formatTimeAgo(user.lastSeenAt)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <MiniBarChart title="Performance Monitoring" subtitle="API response and throughput samples" data={widgets.performance || []} accentClass="bg-violet-400/80" />
                        <div className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-6">
                            <h2 className="text-lg font-bold text-white">Slow Request Analysis</h2>
                            <p className="mt-1 text-xs text-slate-500">Slowest known API surfaces from the monitoring endpoint.</p>
                            <div className="mt-5 space-y-3">
                                {(performance.slowRoutes || []).length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/30 px-4 py-10 text-center text-xs text-slate-500">
                                        No slow route samples available yet.
                                    </div>
                                ) : performance.slowRoutes.map((route: any) => (
                                    <div key={route.route} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="truncate text-sm font-bold text-white">{route.route}</p>
                                            <p className="text-xs font-black text-amber-200">{formatMs(route.maxDurationMs)}</p>
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500">{formatNumber(route.requests)} requests | {formatMs(route.avgDurationMs)} avg</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {section === "forecast" && (
                <>
                    <div className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-6">
                        <h2 className="text-lg font-bold text-white">Forecast & Prediction</h2>
                        <p className="mt-1 text-xs text-slate-500">Projected usage windows based on current traffic and growth signals.</p>
                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {(forecast.windows || []).map((window: any) => (
                                <div key={window.months} className={`rounded-2xl border p-4 ${window.scalingRequired ? "border-amber-500/25 bg-amber-500/10" : "border-white/10 bg-black/30"}`}>
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{window.months} month</p>
                                    <p className="mt-3 text-2xl font-bold text-white">{formatNumber(window.estimatedConcurrentUsers)}</p>
                                    <p className="mt-1 text-xs text-slate-500">Projected concurrent users</p>
                                    <p className="mt-3 text-xs text-slate-400">Storage: {formatBytes(window.estimatedStorageBytes)}</p>
                                    <p className="mt-1 text-xs text-slate-400">Bandwidth: {formatBytes(window.estimatedBandwidthBytes)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <div className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-6">
                            <h2 className="text-lg font-bold text-white">Scalability Analysis</h2>
                            <p className="mt-1 text-xs text-slate-500">Estimated safe capacity and bottleneck signals.</p>
                            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {[
                                    ["Max concurrent users", formatNumber(scalability.estimatedMaximumConcurrentUsers)],
                                    ["Capacity remaining", formatNumber(scalability.capacityRemainingUsers)],
                                    ["Utilization", formatPercent(scalability.currentUtilizationPercent)],
                                    ["Scale status", scalability.scaleStatus || "stable"],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">{label}</p>
                                        <p className="mt-3 text-xl font-bold text-white">{value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-5 flex flex-wrap gap-2">
                                {(scalability.bottlenecks || []).map((item: any) => (
                                    <span key={item.label} className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-100">
                                        {item.label}: {formatPercent(item.value)}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-6">
                            <h2 className="text-lg font-bold text-white">Alerts & Recommendations</h2>
                            <p className="mt-1 text-xs text-slate-500">Operational warnings and next scaling actions.</p>
                            <div className="mt-5 space-y-3">
                                {alerts.map((alert) => (
                                    <div key={`${alert.title}-${alert.message}`} className={`rounded-2xl border px-4 py-3 ${severityTone(alert.severity)}`}>
                                        <p className="text-sm font-bold">{alert.title || "operational_alert"}</p>
                                        <p className="mt-1 text-xs opacity-80">{alert.message}</p>
                                    </div>
                                ))}
                                {recommendations.map((item) => (
                                    <div key={item} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
