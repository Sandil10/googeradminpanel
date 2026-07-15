"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/* ── Server Capacity Planner ─────────────────────────────────────────────
   Small boxes for each hosting option + shared components with estimated
   market price ranges (EUR/month). Pick a target concurrent-user level and
   the panel live-computes supported DAU and highlights the best-fit server. */

const SERVER_TIERS = [
    {
        key: "vps",
        name: "Cloud VPS (shared)",
        spec: "12 vCPU · 48 GB RAM · NVMe",
        example: "Contabo VPS 40 class",
        priceMin: 25,
        priceMax: 40,
        maxConcurrent: 4000,
        note: "Shared cores — performance varies with host neighbors",
    },
    {
        key: "dedicated",
        name: "Dedicated bare-metal",
        spec: "Ryzen 9 7900 · 12C/24T · 64 GB",
        example: "Hetzner AX / Contabo dedicated class",
        priceMin: 105,
        priceMax: 150,
        maxConcurrent: 12000,
        note: "Consistent dedicated cores, ~2-3× VPS per-core speed",
    },
    {
        key: "cluster",
        name: "2× Dedicated + Load Balancer",
        spec: "24C/48T total · 128 GB · HA failover",
        example: "Two nodes behind Cloudflare LB",
        priceMin: 220,
        priceMax: 320,
        maxConcurrent: 25000,
        note: "No single point of failure; add nodes to keep scaling",
    },
];

const COMPONENT_COSTS = [
    { key: "db", name: "Managed PostgreSQL", detail: "RDS / managed class, 2-4 vCPU", priceMin: 15, priceMax: 60, flag: "separateDatabase" },
    { key: "s3", name: "S3 Object Storage", detail: "media bucket + requests", priceMin: 5, priceMax: 25, flag: "objectStorageConfigured" },
    { key: "cdn", name: "CDN (Cloudflare)", detail: "static + media edge cache", priceMin: 0, priceMax: 20, flag: null },
    { key: "redis", name: "Redis cache", detail: "in Docker (free) or managed", priceMin: 0, priceMax: 15, flag: "redisConfigured" },
];

// DAU ≈ peak concurrent × 12-20 (peak concurrency is ~5-8% of DAU for social apps)
const DAU_MIN_FACTOR = 12;
const DAU_MAX_FACTOR = 20;

function CapacityPlanner({
    overview,
    currentServer,
    currentCapacity,
    liveConcurrent,
}: {
    overview: any;
    currentServer: any;
    currentCapacity: number;
    liveConcurrent: number;
}) {
    const [target, setTarget] = useState(5000);

    const dauMin = target * DAU_MIN_FACTOR;
    const dauMax = target * DAU_MAX_FACTOR;
    const peakRps = Math.round(target * 0.4);
    const recommended = SERVER_TIERS.find((tier) => tier.maxConcurrent >= target * 1.25) || SERVER_TIERS[SERVER_TIERS.length - 1];
    const componentsMin = COMPONENT_COSTS.reduce((sum, item) => sum + item.priceMin, 0);
    const componentsMax = COMPONENT_COSTS.reduce((sum, item) => sum + item.priceMax, 0);
    const totalMin = recommended.priceMin + componentsMin;
    const totalMax = recommended.priceMax + componentsMax;
    const currentCovers = currentCapacity >= target;

    return (
        <div className="rounded-3xl border border-[#1a1a1a] bg-[#09090b] p-6">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white">Server Capacity Planner</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Pick a concurrent-user target — supported DAU and the best-fit server update live. Prices are estimated market ranges (EUR/month).
                    </p>
                </div>
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                    Now live: {formatNumber(liveConcurrent)} concurrent
                </div>
            </div>

            {/* target selector */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Target concurrent users</p>
                    <div className="flex gap-2">
                        {[1000, 3000, 5000, 10000, 20000].map((preset) => (
                            <button
                                key={preset}
                                onClick={() => setTarget(preset)}
                                className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                                    target === preset
                                        ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-100"
                                        : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                                }`}
                            >
                                {preset >= 1000 ? `${preset / 1000}k` : preset}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-4">
                    <input
                        type="range"
                        min={100}
                        max={25000}
                        step={100}
                        value={target}
                        onChange={(event) => setTarget(Number(event.target.value))}
                        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
                    />
                    <span className="w-24 text-right text-2xl font-bold text-white">{formatNumber(target)}</span>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/70">Supported DAU</p>
                        <p className="mt-2 text-xl font-bold text-white">{formatNumber(dauMin)} – {formatNumber(dauMax)}</p>
                        <p className="mt-1 text-[11px] text-slate-500">daily active users at this concurrency</p>
                    </div>
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300/70">Peak load</p>
                        <p className="mt-2 text-xl font-bold text-white">~{formatNumber(peakRps)} req/s</p>
                        <p className="mt-1 text-[11px] text-slate-500">API requests at peak (excl. CDN traffic)</p>
                    </div>
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/70">Estimated total cost</p>
                        <p className="mt-2 text-xl font-bold text-white">€{formatNumber(totalMin)} – €{formatNumber(totalMax)}<span className="text-xs text-slate-500"> /mo</span></p>
                        <p className="mt-1 text-[11px] text-slate-500">best-fit server + all components</p>
                    </div>
                </div>
            </div>

            {/* server boxes */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className={`rounded-2xl border p-4 ${currentCovers ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-black/30"}`}>
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-white">Current server</p>
                        {currentCovers ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">Covers target</span>
                        ) : (
                            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-rose-200">Below target</span>
                        )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                        {formatNumber(currentServer.cpuCores || 0)} cores · {formatBytes(currentServer.totalMemoryBytes)} RAM
                    </p>
                    <p className="mt-3 text-lg font-bold text-white">≈ {formatNumber(currentCapacity)} concurrent</p>
                    <p className="text-[11px] text-slate-500">≈ {formatNumber(currentCapacity * DAU_MIN_FACTOR)} – {formatNumber(currentCapacity * DAU_MAX_FACTOR)} DAU</p>
                    <p className="mt-2 text-[10px] text-slate-600">live estimate from this machine's signals</p>
                </div>
                {SERVER_TIERS.map((tier) => {
                    const isBest = tier.key === recommended.key;
                    const covers = tier.maxConcurrent >= target;
                    return (
                        <div key={tier.key} className={`relative rounded-2xl border p-4 ${isBest ? "border-cyan-500/40 bg-cyan-500/10" : "border-white/10 bg-black/30"}`}>
                            {isBest && (
                                <span className="absolute -top-2.5 right-4 rounded-full border border-cyan-400/40 bg-[#0a2a33] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200">
                                    Best fit
                                </span>
                            )}
                            <p className="text-sm font-bold text-white">{tier.name}</p>
                            <p className="mt-1 text-[11px] text-slate-500">{tier.spec}</p>
                            <p className="text-[10px] text-slate-600">{tier.example}</p>
                            <p className="mt-3 text-lg font-bold text-white">
                                €{tier.priceMin}–{tier.priceMax}<span className="text-xs text-slate-500"> /mo</span>
                            </p>
                            <p className={`text-[11px] ${covers ? "text-emerald-300/80" : "text-slate-500"}`}>
                                up to ≈ {formatNumber(tier.maxConcurrent)} concurrent
                            </p>
                            <p className="text-[11px] text-slate-500">
                                ≈ {formatNumber(tier.maxConcurrent * DAU_MIN_FACTOR)} – {formatNumber(tier.maxConcurrent * DAU_MAX_FACTOR)} DAU
                            </p>
                            <p className="mt-2 text-[10px] leading-relaxed text-slate-600">{tier.note}</p>
                        </div>
                    );
                })}
            </div>

            {/* component boxes */}
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                {COMPONENT_COSTS.map((item) => {
                    const active = item.flag ? Boolean(overview?.[item.flag]) : true;
                    return (
                        <div key={item.key} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold text-white">{item.name}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${
                                    active ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                                }`}>
                                    {active ? "In use" : "Not set"}
                                </span>
                            </div>
                            <p className="mt-2 text-sm font-bold text-white">€{item.priceMin}–{item.priceMax}<span className="text-[10px] text-slate-500"> /mo</span></p>
                            <p className="mt-1 text-[10px] text-slate-600">{item.detail}</p>
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

    // ── Live pulse: lightweight presence counts polled every 2s ──
    // The heavy full analysis stays on 30s; this keeps the concurrent-user
    // counter genuinely live (bounded by the app's presence heartbeat, not the page).
    const [pulse, setPulse] = useState<any | null>(null);
    const [delta, setDelta] = useState(0);
    const prevConcurrentRef = useRef<number | null>(null);

    useEffect(() => {
        let stopped = false;
        const poll = async () => {
            if (document.visibilityState !== "visible") return;
            try {
                const p = await adminService.fetchTrafficPulse();
                if (stopped || !p?.success || p?.available === false) return;
                setPulse(p);
                const current = numberValue(p.activeConcurrentUsers);
                if (prevConcurrentRef.current !== null && current !== prevConcurrentRef.current) {
                    setDelta(current - prevConcurrentRef.current);
                }
                prevConcurrentRef.current = current;
            } catch {
                /* pulse failures are silent — the 30s full refresh still covers the page */
            }
        };
        void poll();
        const id = window.setInterval(poll, 2000);
        return () => {
            stopped = true;
            window.clearInterval(id);
        };
    }, []);

    const overview = analysis?.overview || {};
    const liveTraffic = analysis?.liveTraffic || {};
    const performance = analysis?.performance || {};
    const scalability = analysis?.scalability || {};
    const forecast = analysis?.forecast || {};
    const widgets = analysis?.widgets || {};
    const alerts = analysis?.alerts?.items || [];
    const recommendations = analysis?.alerts?.recommendations || [];
    // pulse (2s) overrides the slower 30s payload for the live numbers
    const live = pulse?.available !== false && pulse ? { ...liveTraffic, ...pulse } : liveTraffic;
    const recentUsers = (pulse?.recentUsers?.length ? pulse.recentUsers : null)
        || analysis?.recentUsers || liveTraffic.recentUsers || [];
    const server = overview.server || {};
    const database = overview.database || {};
    const storage = overview.storage || {};

    const headlineCards = useMemo(() => ([
        {
            title: "Live Concurrent Users",
            value: formatNumber(live.activeConcurrentUsers),
            detail: `${formatNumber(live.onlineUsers)} online right now`,
            icon: "people-outline",
            tone: "text-cyan-300 border-cyan-500/20 bg-cyan-500/10",
            isLive: true,
        },
        {
            title: "Daily Active Users",
            value: formatNumber(live.dailyActiveUsers),
            detail: `${formatNumber(live.monthlyActiveUsers)} monthly active`,
            icon: "pulse-outline",
            tone: "text-blue-300 border-blue-500/20 bg-blue-500/10",
            isLive: false,
        },
        {
            title: "Requests Per Second",
            value: formatNumber(live.requestsPerSecond, 2),
            detail: `${formatMs(liveTraffic.apiResponseTimes?.averageMs)} average response`,
            icon: "flash-outline",
            tone: "text-violet-300 border-violet-500/20 bg-violet-500/10",
            isLive: false,
        },
        {
            title: "Estimated Capacity",
            value: formatNumber(scalability.estimatedMaximumConcurrentUsers),
            detail: `${formatPercent(scalability.currentUtilizationPercent)} utilized`,
            icon: "bar-chart-outline",
            tone: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10",
            isLive: false,
        },
    ]), [live, liveTraffic, scalability]);

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
                        Updated {formatTimeAgo(pulse?.generatedAt || analysis?.generatedAt)}
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
                        <div className="flex items-start justify-between">
                            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border ${card.tone}`}>
                                <IonIcon name={card.icon} className="text-xl" />
                            </div>
                            {card.isLive && pulse && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-200">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                    </span>
                                    Live 2s
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{card.title}</p>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-white">{loading && !pulse ? "..." : card.value}</span>
                            {card.isLive && delta !== 0 && (
                                <span className={`inline-flex items-center gap-0.5 text-sm font-black ${delta > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                    <IonIcon name={delta > 0 ? "caret-up" : "caret-down"} className="text-xs" />
                                    {Math.abs(delta)}
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
                    </div>
                ))}
            </div>

            <CapacityPlanner
                overview={overview}
                currentServer={server}
                currentCapacity={numberValue(scalability.estimatedMaximumConcurrentUsers)}
                liveConcurrent={numberValue(live.activeConcurrentUsers)}
            />

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
                                    [
                                        "Storage",
                                        formatBytes(storage.source === "s3" ? storage.objectStorageBytes : storage.localUploadBytes),
                                        storage.source === "s3"
                                            ? `S3 bucket usage - ${formatNumber(storage.objectCount)} objects`
                                            : overview.objectStorageConfigured
                                                ? "S3 usage unavailable - showing local uploads"
                                                : "Local/media storage usage",
                                    ],
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
