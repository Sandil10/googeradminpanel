"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdsTransactionTable from "@/components/AdsTransactionTable";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import { displayName } from "@/utils/displayName";

type WalletTx = {
    id: number;
    type: string;
    amount: string;
    commission: string;
    commission_percentage: string;
    note: string | null;
    status: string;
    created_at: string;
    sender_username: string | null;
    sender_full_name: string | null;
    sender_readable_id: string | null;
    sender_user_type: string | null;
    receiver_username: string | null;
    receiver_full_name: string | null;
    receiver_readable_id: string | null;
    receiver_user_type: string | null;
};

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
    transfer:            { label: "Transfer",          color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
    request:             { label: "Request",           color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20" },
    order_hold:          { label: "Order Hold",        color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
    order_release:       { label: "Order Release",     color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    order_refund:        { label: "Order Refund",      color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    withdrawal_hold:     { label: "Withdrawal",        color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20" },
    withdrawal_refund:   { label: "Withdrawal Refund", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    capital_transfer:    { label: "Capital Transfer",  color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/20" },
    ad_coin:             { label: "Ad Coin",           color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20" },
    profile_promote:     { label: "Profile Promote",   color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/20" },
    ad_promote:          { label: "Ad Promote",        color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20" },
    product_commission:  { label: "Commission",        color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/20" },
    referral_commission: { label: "Referral",          color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/20" },
    seller_discount:     { label: "Seller Discount",   color: "text-lime-400",    bg: "bg-lime-500/10",    border: "border-lime-500/20" },
    discount_refund:     { label: "Discount Refund",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    sub_auto_renew:      { label: "Subscription",      color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/20" },
    promo_ad:            { label: "Promo Ad",          color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20" },
};

const STATUS_META: Record<string, { color: string; bg: string; border: string }> = {
    pending:   { color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
    accepted:  { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    completed: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    rejected:  { color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20" },
    cancelled: { color: "text-slate-400",   bg: "bg-white/5",        border: "border-white/10" },
    refunded:  { color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/20" },
    held:      { color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
};

function getTypeMeta(type: string) {
    return TYPE_META[type] ?? { label: type ?? "Unknown", color: "text-white/60", bg: "bg-white/5", border: "border-white/10" };
}

function getStatusMeta(status: string) {
    return STATUS_META[status] ?? { color: "text-white/60", bg: "bg-white/5", border: "border-white/10" };
}

function formatTime(dateStr: string) {
    try {
        return new Intl.DateTimeFormat("en-LK", { timeZone: "Asia/Colombo",
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        }).format(new Date(dateStr.includes("Z") || dateStr.includes("+") ? dateStr : dateStr + " UTC"));
    } catch {
        return dateStr;
    }
}

function timeAgo(dateStr: string, nowMs: number): string {
    const diff = Math.floor((nowMs - new Date(dateStr.includes("Z") || dateStr.includes("+") ? dateStr : dateStr + " UTC").getTime()) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

const PAGE_SIZE = 10;

export default function AllHistoryPage() {
    const [rows, setRows] = useState<WalletTx[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [livePulse, setLivePulse] = useState(false);
    const [nowMs, setNowMs] = useState(() => Date.now());

    const loadRows = useCallback(async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const data = await adminService.fetchAllWalletTransactions();
            setRows(data || []);
            setLastUpdated(new Date());
            if (isPolling) {
                setLivePulse(true);
                setTimeout(() => setLivePulse(false), 800);
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRows(false);
        const interval = setInterval(() => loadRows(true), 5000);
        return () => clearInterval(interval);
    }, [loadRows]);

    useEffect(() => {
        const tick = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(tick);
    }, []);

    const uniqueTypes = useMemo(() => {
        const set = new Set(rows.map((r) => r.type).filter(Boolean));
        return Array.from(set).sort();
    }, [rows]);

    const uniqueStatuses = useMemo(() => {
        const set = new Set(rows.map((r) => r.status).filter(Boolean));
        return Array.from(set).sort();
    }, [rows]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (typeFilter !== "all" && r.type !== typeFilter) return false;
            if (statusFilter !== "all" && r.status !== statusFilter) return false;
            if (q) {
                const haystack = [
                    r.sender_username, r.sender_full_name, r.sender_readable_id,
                    r.receiver_username, r.receiver_full_name, r.receiver_readable_id,
                    r.note, r.type, r.status, String(r.id),
                ].join(" ").toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [rows, search, typeFilter, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pagedRows = useMemo(
        () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [filtered, page]
    );

    useEffect(() => {
        setPage(1);
    }, [search, typeFilter, statusFilter]);

    const totalVolume = useMemo(
        () => rows.reduce((s, r) => s + parseFloat(r.amount || "0"), 0),
        [rows]
    );

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Wallet Transactions</p>
                <h1 className="mt-1 text-xl font-black uppercase tracking-tight text-white">All History</h1>
                <p className="mt-2 max-w-2xl text-sm font-medium text-white/45">
                    Every wallet transaction recorded across the entire Googer system.
                </p>
            </div>

            {/* Summary strip */}
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 flex flex-wrap items-center gap-6">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35 mb-1">Total Records</p>
                    <p className="text-2xl font-black text-white">{rows.length.toLocaleString()}</p>
                </div>
                <div className="w-px h-10 bg-white/8 hidden sm:block" />
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35 mb-1">Total Volume</p>
                    <p className="text-2xl font-black text-white">
                        R {totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="w-px h-10 bg-white/8 hidden sm:block" />
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35 mb-1">Showing</p>
                    <p className="text-2xl font-black text-white">{filtered.length.toLocaleString()}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 mb-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${livePulse ? 'bg-emerald-300' : 'bg-emerald-500'} transition-colors`} />
                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Live</span>
                        </div>
                        {lastUpdated && (
                            <p className="text-[8px] text-white/25">
                                Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </p>
                        )}
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                        <IonIcon name="albums-outline" className="text-2xl text-white" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <input
                    type="text"
                    placeholder="Search by user, note, ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 min-w-[200px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[11px] font-semibold text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
                />
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[11px] font-semibold text-white focus:outline-none focus:border-white/25 cursor-pointer"
                >
                    <option value="all">All Types</option>
                    {uniqueTypes.map((t) => (
                        <option key={t} value={t}>{getTypeMeta(t).label}</option>
                    ))}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[11px] font-semibold text-white focus:outline-none focus:border-white/25 cursor-pointer"
                >
                    <option value="all">All Statuses</option>
                    {uniqueStatuses.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
                {loading ? (
                    <div className="p-16 text-center text-[10px] font-black uppercase tracking-widest text-white/25">
                        Loading all transactions…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-16 text-center">
                        <IonIcon name="albums-outline" className="text-4xl text-white/10 block mx-auto mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/25">No transactions found</p>
                    </div>
                ) : (
                    <>
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-white/[0.06] text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                                        <th className="px-5 py-4">ID</th>
                                        <th className="px-5 py-4">Sender</th>
                                        <th className="px-5 py-4">Receiver</th>
                                        <th className="px-5 py-4 text-center">Type</th>
                                        <th className="px-5 py-4 text-center">Status</th>
                                        <th className="px-5 py-4">Note</th>
                                        <th className="px-5 py-4 text-right">Amount</th>
                                        <th className="px-5 py-4 text-right">When</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {pagedRows.map((row) => {
                                        const tm = getTypeMeta(row.type);
                                        const sm = getStatusMeta(row.status);
                                        return (
                                            <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                                                {/* ID */}
                                                <td className="px-5 py-4">
                                                    <p className="text-[10px] font-mono text-white/40">#{row.id}</p>
                                                </td>
                                                {/* Sender */}
                                                <td className="px-5 py-4">
                                                    <p className="text-[11px] font-bold text-white">{displayName(row.sender_user_type, row.sender_full_name, row.sender_username) || "—"}</p>
                                                    <p className="mt-0.5 text-[9px] text-white/40">@{row.sender_username || "—"}</p>
                                                    <p className="mt-0.5 text-[9px] font-mono text-white/25">ID: {row.sender_readable_id || "—"}</p>
                                                    {row.sender_user_type && (
                                                        <p className="mt-0.5 text-[8px] uppercase font-black tracking-widest text-white/20">{row.sender_user_type}</p>
                                                    )}
                                                </td>
                                                {/* Receiver */}
                                                <td className="px-5 py-4">
                                                    {row.receiver_username ? (
                                                        <>
                                                            <p className="text-[11px] font-bold text-white">{displayName(row.receiver_user_type, row.receiver_full_name, row.receiver_username)}</p>
                                                            <p className="mt-0.5 text-[9px] text-white/40">@{row.receiver_username}</p>
                                                            <p className="mt-0.5 text-[9px] font-mono text-white/25">ID: {row.receiver_readable_id || "—"}</p>
                                                            {row.receiver_user_type && (
                                                                <p className="mt-0.5 text-[8px] uppercase font-black tracking-widest text-white/20">{row.receiver_user_type}</p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <p className="text-[10px] text-white/20">—</p>
                                                    )}
                                                </td>
                                                {/* Type */}
                                                <td className="px-5 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${tm.bg} ${tm.color} ${tm.border}`}>
                                                        {tm.label}
                                                    </span>
                                                </td>
                                                {/* Status */}
                                                <td className="px-5 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${sm.bg} ${sm.color} ${sm.border}`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                {/* Note */}
                                                <td className="px-5 py-4">
                                                    <p className="max-w-[200px] text-[10px] text-white/50 truncate">{row.note || "—"}</p>
                                                    {parseFloat(row.commission_percentage || "0") > 0 && (
                                                        <p className="mt-0.5 text-[9px] text-white/25">{row.commission_percentage}% discount</p>
                                                    )}
                                                </td>
                                                {/* Amount */}
                                                <td className="px-5 py-4 text-right">
                                                    <p className="text-[12px] font-black text-white">
                                                        R {parseFloat(row.amount || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                    {parseFloat(row.commission || "0") > 0 && (
                                                        <p className="mt-0.5 text-[9px] text-white/30">
                                                            fee: R {parseFloat(row.commission).toFixed(2)}
                                                        </p>
                                                    )}
                                                </td>
                                                {/* When */}
                                                <td className="px-5 py-4 text-right">
                                                    <p className="text-[10px] font-black text-emerald-400 whitespace-nowrap">{timeAgo(row.created_at, nowMs)}</p>
                                                    <p className="mt-0.5 text-[10px] font-bold text-white/40 whitespace-nowrap">{formatTime(row.created_at)}</p>
                                                    </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/30">
                                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                                >
                                    Prev
                                </button>
                                <span className="text-[10px] font-black uppercase tracking-[0.08em] text-white/40">
                                    {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}




