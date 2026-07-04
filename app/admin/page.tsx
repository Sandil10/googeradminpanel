"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import IonIcon from "../components/IonIcon";
import { adminService } from "../services/adminService";
import { authService } from "../services/authService";

interface Stats {
    totalUsers: string;
    activeSellers: string;
    pendingProducts: string;
    totalUsersBalance: string | number;
    googerBalance: string | number;
}

interface Activity {
    id: string;
    kind: string;
    user: string;
    detail: string;
    status: string;
    created_at: string;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function activityIcon(kind: string): string {
    if (kind.includes("Product")) return "bag-handle";
    if (kind.includes("Sale")) return "cash";
    if (kind.includes("Top-up")) return "arrow-up-circle";
    return "swap-horizontal";
}

function activityColor(status: string): string {
    if (status === "active" || status === "accepted") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (status === "reviewing" || status === "pending") return "text-purple-400 bg-purple-500/10 border-purple-500/20";
    if (status === "rejected") return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    return "text-slate-400 bg-white/5 border-white/10";
}

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<Stats | null>(null);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [mainWalletBalance, setMainWalletBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const redirectToLogin = useCallback(() => {
        try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (_) {}
        router.replace('/');
    }, [router]);

    useEffect(() => {
        if (!authService.isAuthenticated()) {
            redirectToLogin();
        }
    }, [redirectToLogin]);

    const loadData = useCallback(async (isPolling = false) => {
        if (!authService.isAuthenticated()) {
            redirectToLogin();
            return;
        }
        try {
            if (!isPolling) setLoading(true);
            const [statsData, activityData, profile] = await Promise.all([
                adminService.fetchStats(),
                adminService.fetchRecentActivity().catch(() => []),
                authService.getProfile(),
            ]);
            setStats(statsData);
            setActivity(activityData || []);
            setMainWalletBalance(parseFloat(String(profile?.wallet_balance || 0)) || 0);
            setLastUpdated(new Date());
        } catch (err: any) {
            const msg = (err?.message || '').toLowerCase();
            if (
                msg.includes('authentication') ||
                msg.includes('no token') ||
                msg.includes('admin access') ||
                msg.includes('unauthorized') ||
                msg.includes('forbidden') ||
                msg.includes('session expired')
            ) {
                redirectToLogin();
                return;
            }
            console.error("Dashboard load error:", err);
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, [redirectToLogin]);

    useEffect(() => {
        loadData(false);
        const interval = setInterval(() => {
            if (document.visibilityState !== "visible") return;
            void loadData(true);
        }, 15000);
        return () => clearInterval(interval);
    }, [loadData]);

    const statCards = [
        {
            name: "Total Users",
            value: stats ? Number(stats.totalUsers).toLocaleString() : "—",
            icon: "people",
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
            href: "/admin/users/all",
        },
        {
            name: "Active Sellers",
            value: stats ? Number(stats.activeSellers).toLocaleString() : "—",
            icon: "storefront",
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            border: "border-purple-500/20",
            href: "/admin/users/sellers",
        },
        {
            name: "Googer Total Balance",
            value: stats ? `R ${parseFloat(String(stats.googerBalance || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
            icon: "cash",
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            href: "/admin/wallet/main",
        },
        {
            name: "Main Wallet Balance",
            value: `R ${mainWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: "wallet",
            color: "text-cyan-400",
            bg: "bg-cyan-500/10",
            border: "border-cyan-500/20",
            href: "/admin/wallet/main",
        },
        {
            name: "Total Users Balance",
            value: stats ? `R ${parseFloat(String(stats.totalUsersBalance || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
            icon: "people",
            color: "text-fuchsia-400",
            bg: "bg-fuchsia-500/10",
            border: "border-fuchsia-500/20",
            href: "/admin/users/all",
        },
        {
            name: "Pending Reviews",
            value: stats ? Number(stats.pendingProducts).toLocaleString() : "—",
            icon: "bag-handle",
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
            href: "/admin/products/reviewed",
        },
    ];

    // Simple bar chart: activity count per hour for last 12 hours
    const chartBars = Array.from({ length: 12 }, (_, i) => {
        const hour = new Date(Date.now() - (11 - i) * 3600000);
        const count = activity.filter(a => {
            const d = new Date(a.created_at);
            return d.getHours() === hour.getHours() && d.toDateString() === hour.toDateString();
        }).length;
        return { label: `${hour.getHours()}:00`, count, max: count };
    });
    const maxBar = Math.max(...chartBars.map(b => b.count), 1);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard Overview</h1>
                    <p className="text-slate-400 mt-1 text-sm">Real-time platform metrics.</p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            Updated {timeAgo(lastUpdated.toISOString())}
                        </span>
                    )}
                    <button
                        onClick={() => loadData(false)}
                        disabled={loading}
                        className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        <IonIcon name={loading ? "sync" : "refresh-outline"} className={`text-xs ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {statCards.map((stat) => (
                    <Link
                        key={stat.name}
                        href={stat.href}
                        className={`bg-[#09090b] border border-[#1a1a1a] rounded-2xl p-4 sm:p-6 hover:border-white/20 transition-all group hover:scale-[1.02] active:scale-[0.98] block ${loading ? "animate-pulse" : ""}`}
                    >
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${stat.bg} border ${stat.border} ${stat.color} flex items-center justify-center text-xl sm:text-2xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                            <IonIcon name={stat.icon + "-outline"} />
                        </div>
                        <p className="text-slate-400 text-xs sm:text-sm font-medium leading-tight">{stat.name}</p>
                        <h3 className={`text-lg sm:text-2xl font-bold text-white mt-1 ${loading && !stats ? "opacity-30" : ""}`}>
                            {stat.value}
                        </h3>
                        <div className={`flex items-center gap-1 mt-2 text-xs ${stat.color} opacity-60`}>
                            <IonIcon name="pulse-outline" />
                            <span>Live</span>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Chart */}
                <div className="lg:col-span-2 bg-[#09090b] border border-[#1a1a1a] rounded-2xl p-6 md:p-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-white">Platform Activity</h3>
                            <p className="text-slate-500 text-xs mt-0.5">Hourly requests — last 12 hours</p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live</span>
                        </div>
                    </div>
                    <div className="relative">
                        {/* Horizontal grid lines */}
                        <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="w-full border-t border-white/[0.04]" />
                            ))}
                        </div>
                        <div className="h-48 flex items-end gap-1.5 relative">
                            {chartBars.map((bar, i) => {
                                const height = maxBar > 0 ? Math.max((bar.count / maxBar) * 100, bar.count > 0 ? 8 : 2) : 2;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
                                        <div className="w-full relative flex flex-col justify-end" style={{ height: "100%" }}>
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-all duration-150 bg-[#09090b] border border-white/15 rounded-lg px-2 py-1 text-[9px] text-white font-black whitespace-nowrap z-10 shadow-xl">
                                                {bar.count > 0 ? `${bar.count} event${bar.count !== 1 ? "s" : ""}` : "0 events"}
                                                <span className="block text-slate-500 font-medium text-[8px]">{bar.label}</span>
                                            </div>
                                            <div
                                                className={`w-full rounded-t-lg transition-all duration-700 ease-out ${bar.count > 0
                                                    ? "bg-gradient-to-t from-blue-700 via-blue-500 to-blue-400 group-hover/bar:from-blue-600 group-hover/bar:via-blue-400 group-hover/bar:to-cyan-300 shadow-[0_-2px_12px_rgba(59,130,246,0.3)] group-hover/bar:shadow-[0_-2px_16px_rgba(59,130,246,0.5)]"
                                                    : "bg-white/[0.04] group-hover/bar:bg-white/10"}`}
                                                style={{ height: `${height}%` }}
                                            />
                                        </div>
                                        <span className="text-[8px] text-slate-600 tabular-nums">{bar.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {activity.length === 0 && !loading && (
                        <p className="text-center text-slate-600 text-xs mt-4 italic">No recent activity to display</p>
                    )}
                </div>

                {/* Recent Activity Feed */}
                <div className="bg-[#09090b] border border-[#1a1a1a] rounded-2xl p-6 md:p-8 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white">Recent Activity</h3>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar max-h-64 pr-1">
                        {loading && activity.length === 0 ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex gap-3 items-start animate-pulse">
                                    <div className="w-9 h-9 rounded-xl bg-white/5 shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 bg-white/5 rounded w-3/4" />
                                        <div className="h-2.5 bg-white/5 rounded w-1/2" />
                                    </div>
                                </div>
                            ))
                        ) : activity.length === 0 ? (
                            <div className="text-center py-8">
                                <IonIcon name="pulse-outline" className="text-4xl text-slate-700 block mx-auto mb-2" />
                                <p className="text-slate-600 text-xs italic">No activity yet</p>
                            </div>
                        ) : (
                            activity.map((item) => (
                                <div key={item.id} className="flex gap-3 items-start group/item hover:bg-white/[0.02] rounded-xl p-2 -mx-2 transition-colors">
                                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm shrink-0 ${activityColor(item.status)}`}>
                                        <IonIcon name={`${activityIcon(item.kind)}-outline`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{item.kind}</p>
                                        <p className="text-[10px] text-slate-500 truncate">From {item.user}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] font-bold text-white truncate max-w-[80px]">{item.detail}</p>
                                        <p className="text-[9px] text-slate-600 uppercase mt-0.5">{timeAgo(item.created_at)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                </div>
            </div>

            {/* Quick Nav */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "All Products", href: "/admin/products/all", icon: "bag-handle" },
                    { label: "Review Queue", href: "/admin/products/reviewed", icon: "eye" },
                    { label: "Wallet Topups", href: "/admin/wallet/topup", icon: "arrow-up-circle" },
                    { label: "All Users", href: "/admin/users/all", icon: "people" },
                ].map(link => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-slate-400 hover:text-white group"
                    >
                        <IonIcon name={`${link.icon}-outline`} className="text-lg group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{link.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
