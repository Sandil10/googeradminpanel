"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import { resolveColor, COLOR_OPTIONS, getSavedColors, saveCustomColor, removeCustomColor, type Plan } from "../planUtils";

interface Purchase {
    id: number;
    user_id: number;
    plan_id: number;
    plan_slug: string;
    plan_name: string;
    price_paid: string;
    duration_days: number;
    status: string;
    auto_renew: boolean;
    started_at: string;
    expires_at: string | null;
    created_at: string;
    username: string;
    full_name: string;
    email: string;
    readable_user_id: string;
    user_type: string;
    is_verified: boolean;
    verification_badge_color: string | null;
    verification_badge_tick_color: string | null;
    profile_picture: string | null;
    badge_color: string;
    verified_tick: boolean;
    plan_price: string;
}

// Per-row assign modal: badge + free plan
interface RowAssignModal {
    open: boolean;
    purchase: Purchase | null;
    tab: 'badge' | 'plan';
    // badge
    is_verified: boolean;
    badge_color: string;
    badge_tick_color: string;
    // plan
    selectedPlanId: number | null;
    planSearch: string;
    saving: boolean;
}

// Top-level "Assign User" modal — search user, then same Badge+FreePlan tabs
interface AssignModalState {
    open: boolean;
    step: 'search_user' | 'assign';
    userSearchQuery: string;
    userResults: { id: number; username: string; full_name: string; email: string; user_id: string; profile_picture: string | null }[];
    userSearchLoading: boolean;
    // selected user
    selectedUser: { id: number; username: string; full_name: string; email: string; user_id: string; profile_picture: string | null } | null;
    // badge tab
    tab: 'badge' | 'plan';
    is_verified: boolean;
    badge_color: string;
    badge_tick_color: string;
    // plan tab
    selectedPlanId: number | null;
    planSearch: string;
    saving: boolean;
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never expires";
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

function isExpiringSoon(expiresAt: string | null) {
    if (!expiresAt) return false;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 3 * 86400000;
}

const USER_TYPE_COLORS: Record<string, string> = {
    admin:    "bg-orange-500/10 text-orange-400 border-orange-500/20",
    employee: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    seller:   "bg-purple-500/10 text-purple-400 border-purple-500/20",
    buyer:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    user:     "bg-white/5 text-slate-400 border-white/10",
};

const DEFAULT_BADGE_COLOR = "gold";

// Rounded seal/rosette verified badge — Twitter/Instagram style
// Red badge → black tick | Black badge → red tick | All others → white tick
function resolveTickColor(color: string, customTickColor?: string) {
    if (customTickColor && customTickColor.match(/^#[0-9a-fA-F]{6}$/)) return customTickColor;
    const isRed   = color === '#ef4444';
    const isBlack = color === '#3d3d3d';
    return isBlack ? '#ef4444' : isRed ? '#000000' : '#ffffff';
}

function VerifiedBadge({ color, tickColor, size = 16 }: { color: string; tickColor?: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.438 1.69-.882.445-.47.749-1.055.878-1.688.13-.633.08-1.29-.144-1.896.587-.274 1.087-.705 1.443-1.245.356-.54.555-1.17.574-1.817z" fill={color} />
            <path d="M7.5 11l2.5 2.5L15 8.5" stroke={resolveTickColor(color, tickColor)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

const EMPTY_ROW_MODAL: RowAssignModal = {
    open: false, purchase: null, tab: 'badge',
    is_verified: false, badge_color: DEFAULT_BADGE_COLOR, badge_tick_color: '',
    selectedPlanId: null, planSearch: '', saving: false,
};

export default function PurchasesPage() {
    const router = useRouter();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const [search, setSearch] = useState("");
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [filterUserType, setFilterUserType] = useState("all");
    const [filterPlan, setFilterPlan] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [savedColors, setSavedColors] = useState<string[]>(() => getSavedColors());
    const [savedColorPage, setSavedColorPage] = useState(0);
    const [customHexInput, setCustomHexInput] = useState('');
    const SAVED_PAGE_SIZE = 5;

    // Per-row assign modal
    const [rowModal, setRowModal] = useState<RowAssignModal>(EMPTY_ROW_MODAL);

    const EMPTY_MODAL: AssignModalState = {
        open: false, step: 'search_user',
        userSearchQuery: '', userResults: [], userSearchLoading: false,
        selectedUser: null, tab: 'badge',
        is_verified: false, badge_color: DEFAULT_BADGE_COLOR, badge_tick_color: '',
        selectedPlanId: null, planSearch: '', saving: false,
    };
    const [modal, setModal] = useState<AssignModalState>(EMPTY_MODAL);

    const userSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = (type: "success" | "error", msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const [pr, plr] = await Promise.all([
                adminService.fetchSubscriptionPurchases(),
                adminService.fetchSubscriptionPlans(),
            ]);
            setPurchases(pr.data || []);
            setPlans((plr.data || []).filter((p: Plan) => !p.is_default));
        } catch (err: any) {
            if (!silent) setError(err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const iv = setInterval(() => load(true), 30_000);
        return () => clearInterval(iv);
    }, []);

    // ── Top-level modal: user search debounce ────────────────────────────────
    useEffect(() => {
        if (!modal.open || modal.step !== 'search_user') return;
        if (userSearchTimeout.current) clearTimeout(userSearchTimeout.current);
        const q = modal.userSearchQuery.trim();
        if (!q) { setModal(m => ({ ...m, userResults: [], userSearchLoading: false })); return; }
        setModal(m => ({ ...m, userSearchLoading: true }));
        userSearchTimeout.current = setTimeout(async () => {
            try {
                const res = await adminService.fetchAllUsers();
                const users: any[] = res?.data || res || [];
                const ql = q.toLowerCase();
                const filtered = users.filter((u: any) =>
                    u.username?.toLowerCase().includes(ql) ||
                    u.full_name?.toLowerCase().includes(ql) ||
                    u.email?.toLowerCase().includes(ql) ||
                    String(u.user_id || '').includes(q)
                ).slice(0, 8);
                setModal(m => ({ ...m, userResults: filtered, userSearchLoading: false }));
            } catch { setModal(m => ({ ...m, userResults: [], userSearchLoading: false })); }
        }, 350);
    }, [modal.userSearchQuery, modal.open, modal.step]);

    // ── Top-level modal handlers ─────────────────────────────────────────────
    const openAssignModal = async () => {
        setModal({ ...EMPTY_MODAL, open: true });
        // prefetch plans in background
        try {
            const plr = await adminService.fetchSubscriptionPlans();
            setPlans((plr.data || []).filter((p: Plan) => !p.is_default));
        } catch {}
    };

    const closeModal = () => setModal(EMPTY_MODAL);

    const handleSelectUser = (user: any) => {
        // Close the search modal and open the exact same rowModal popup
        setModal(EMPTY_MODAL);
        setRowModal({
            open: true,
            purchase: {
                id: 0,
                user_id: user.id,
                plan_id: 0, plan_slug: '', plan_name: '',
                price_paid: '0', duration_days: 0,
                status: 'active', auto_renew: false,
                started_at: '', expires_at: null, created_at: '',
                username: user.username,
                full_name: user.full_name || '',
                email: user.email || '',
                readable_user_id: user.user_id || '',
                user_type: user.user_type || '',
                is_verified: user.is_verified ?? false,
                verification_badge_color: user.verification_badge_color || null,
                verification_badge_tick_color: user.verification_badge_tick_color || null,
                profile_picture: user.profile_picture || null,
                badge_color: '', verified_tick: false, plan_price: '',
            },
            tab: 'badge',
            is_verified: user.is_verified ?? false,
            badge_color: user.verification_badge_color || DEFAULT_BADGE_COLOR,
            badge_tick_color: (user as any).verification_badge_tick_color || '',
            selectedPlanId: null, planSearch: '', saving: false,
        });
    };

    // ── Per-row modal handlers ───────────────────────────────────────────────
    const openRowModal = (p: Purchase) => {
        setSavedColors(getSavedColors());
        setSavedColorPage(0);
        setCustomHexInput('');
        setRowModal({
            open: true, purchase: p, tab: 'badge',
            is_verified: p.is_verified ?? false,
            badge_color: p.verification_badge_color || DEFAULT_BADGE_COLOR,
            badge_tick_color: p.verification_badge_tick_color || '',
            selectedPlanId: null, planSearch: '', saving: false,
        });
    };

    const handleSaveRowBadge = async () => {
        if (!rowModal.purchase) return;
        setRowModal(m => ({ ...m, saving: true }));
        try {
            await adminService.assignVerificationBadge(
                rowModal.purchase.user_id,
                rowModal.is_verified,
                rowModal.is_verified ? rowModal.badge_color : null,
                rowModal.is_verified ? rowModal.badge_tick_color : null
            );
            showToast("success", `Badge ${rowModal.is_verified ? "assigned" : "removed"} for @${rowModal.purchase.username}`);
            setRowModal(EMPTY_ROW_MODAL); load(true);
        } catch (err: any) {
            showToast("error", err.message);
            setRowModal(m => ({ ...m, saving: false }));
        }
    };

    const handleSaveRowPlan = async () => {
        if (!rowModal.purchase || !rowModal.selectedPlanId) return;
        setRowModal(m => ({ ...m, saving: true }));
        try {
            await adminService.assignSubscriptionPlan(rowModal.purchase.user_id, rowModal.selectedPlanId);
            const planName = plans.find(p => p.id === rowModal.selectedPlanId)?.name || "Plan";
            showToast("success", `"${planName}" assigned free to @${rowModal.purchase.username}`);
            setRowModal(EMPTY_ROW_MODAL); load(true);
        } catch (err: any) {
            showToast("error", err.message);
            setRowModal(m => ({ ...m, saving: false }));
        }
    };

    // ── Status toggle ────────────────────────────────────────────────────────
    const handleToggleStatus = async (p: Purchase) => {
        setTogglingId(p.id);
        try {
            const res = await adminService.togglePurchaseStatus(p.id);
            showToast("success", `Subscription ${res.status} for @${p.username}`);
            load(true);
        } catch (err: any) { showToast("error", err.message); }
        finally { setTogglingId(null); }
    };

    // ── Derived data ─────────────────────────────────────────────────────────
    const allUserTypes = Array.from(new Set(purchases.map(p => p.user_type).filter(Boolean)));
    const planCounts: Record<string, number> = {};
    purchases.forEach(p => { planCounts[p.plan_slug] = (planCounts[p.plan_slug] || 0) + 1; });
    const userTypeCounts: Record<string, number> = { all: purchases.length };
    purchases.forEach(p => { const t = p.user_type || "user"; userTypeCounts[t] = (userTypeCounts[t] || 0) + 1; });

    const filtered = purchases.filter(p => {
        const q = search.toLowerCase();
        const matchSearch =
            p.username?.toLowerCase().includes(q) ||
            p.full_name?.toLowerCase().includes(q) ||
            p.plan_name?.toLowerCase().includes(q) ||
            p.email?.toLowerCase().includes(q) ||
            String(p.readable_user_id || '').includes(q);
        // "all" hides cancelled — only show cancelled when explicitly filtered
        const matchStatus = filterStatus === "all"
            ? p.status === 'active'
            : p.status === filterStatus;
        return matchSearch &&
            (filterUserType === "all" || p.user_type === filterUserType) &&
            (filterPlan === "all" || p.plan_slug === filterPlan) &&
            matchStatus;
    });

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-6 space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Purchase Details</h1>
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
                        {loading ? "Loading…" : `${filtered.length} subscriber${filtered.length !== 1 ? "s" : ""}`}
                        {!loading && (
                            <span className="flex items-center gap-1 text-[10px] text-green-500/60 font-medium uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Live
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push("/admin/subscription")}
                        className="flex items-center gap-2 border border-[#2a2a2a] text-gray-300 hover:text-white hover:border-white/30 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                    >
                        <IonIcon name="card-outline" className="text-lg" />
                        Subscription Plans
                    </button>
                    <button
                        onClick={openAssignModal}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors shadow-lg"
                    >
                        <IonIcon name="person-add-outline" className="text-lg" />
                        Assign User
                    </button>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed left-1/2 top-4 z-[100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${toast.type === "success" ? "bg-green-950/90 border-green-500/30 text-green-200" : "bg-red-950/90 border-red-500/30 text-red-200"}`}>
                    <IonIcon name={toast.type === "success" ? "checkmark-circle-outline" : "alert-circle-outline"} className="text-sm shrink-0" />
                    <span className="truncate">{toast.msg}</span>
                </div>
            )}

            {/* Search + Filters */}
            {!loading && !error && purchases.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <IonIcon name="search-outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                        <input
                            type="text"
                            placeholder="Search by user, ID or plan…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-[#0f0f0f] border border-[#2a2a2a] text-white rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-gray-600 w-56"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={filterUserType}
                            onChange={e => setFilterUserType(e.target.value)}
                            className="appearance-none bg-[#0f0f0f] border border-[#2a2a2a] text-white rounded-xl pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-white/30 cursor-pointer"
                        >
                            <option value="all">All Types ({userTypeCounts.all})</option>
                            {allUserTypes.map(t => (
                                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} ({userTypeCounts[t] || 0})</option>
                            ))}
                        </select>
                        <IonIcon name="chevron-down-outline" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none" />
                    </div>
                    <div className="relative">
                        <select
                            value={filterPlan}
                            onChange={e => setFilterPlan(e.target.value)}
                            className="appearance-none bg-[#0f0f0f] border border-[#2a2a2a] text-white rounded-xl pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-white/30 cursor-pointer"
                        >
                            <option value="all">All Plans ({purchases.length})</option>
                            {plans.map(plan => (
                                <option key={plan.slug} value={plan.slug}>{plan.name} ({planCounts[plan.slug] || 0})</option>
                            ))}
                        </select>
                        <IonIcon name="chevron-down-outline" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none" />
                    </div>
                    <div className="relative">
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="appearance-none bg-[#0f0f0f] border border-[#2a2a2a] text-white rounded-xl pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-white/30 cursor-pointer"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <IonIcon name="chevron-down-outline" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none" />
                    </div>
                    {(filterUserType !== "all" || filterPlan !== "all" || filterStatus !== "all") && (
                        <button onClick={() => { setFilterUserType("all"); setFilterPlan("all"); setFilterStatus("all"); }} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
                            <IonIcon name="close-outline" className="text-sm" />Clear
                        </button>
                    )}
                </div>
            )}

            {loading && <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>}

            {error && !loading && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
                    <IonIcon name="alert-circle-outline" className="text-4xl text-red-400 mb-2" />
                    <p className="text-red-400 font-semibold">{error}</p>
                    <button onClick={() => load()} className="mt-3 text-sm text-red-300 underline hover:text-white">Retry</button>
                </div>
            )}

            {!loading && !error && purchases.length === 0 && (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-16 text-center">
                    <IonIcon name="receipt-outline" className="text-5xl text-gray-700 mb-3" />
                    <p className="text-gray-400 font-semibold">No active paid subscribers</p>
                    <p className="text-gray-600 text-sm mt-1">Users who purchase plans will appear here.</p>
                </div>
            )}

            {!loading && !error && purchases.length > 0 && filtered.length === 0 && (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-10 text-center">
                    <IonIcon name="search-outline" className="text-4xl text-gray-700 mb-2" />
                    <p className="text-gray-500 text-sm">No results for current filters</p>
                </div>
            )}

            {/* Table */}
            {!loading && !error && filtered.length > 0 && (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#1a1a1a]">
                                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price Paid</th>
                                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Started</th>
                                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expires</th>
                                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Assign</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#141414]">
                                {filtered.map(p => {
                                    const isBadgeOnly = p.plan_slug === 'badge_only';
                                    const hex = resolveColor(p.badge_color || "silver");
                                    const expiring = isExpiringSoon(p.expires_at);
                                    const isFreeAssign = parseFloat(p.price_paid) === 0;
                                    const isActive = p.status === 'active';
                                    const toggling = togglingId === p.id;
                                    const badgeHex = resolveColor(p.verification_badge_color || DEFAULT_BADGE_COLOR);
                                    return (
                                        <tr key={isBadgeOnly ? `badge-${p.user_id}` : p.id} className="hover:bg-white/[0.02] transition-colors">

                                            {/* User */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => router.push(`/admin/users/${p.user_id}`)}
                                                        className="relative w-9 h-9 shrink-0 group"
                                                        title={`View ${p.username}'s profile`}
                                                    >
                                                        <div className="w-9 h-9 rounded-full bg-[#1a1a1a] overflow-hidden flex items-center justify-center ring-0 group-hover:ring-2 group-hover:ring-white/30 transition-all">
                                                            {p.profile_picture
                                                                ? <img src={p.profile_picture} alt="" className="w-full h-full object-cover" />
                                                                : <IonIcon name="person-outline" className="text-gray-600 text-lg" />}
                                                        </div>
                                                    </button>
                                                    <div>
                                                        <div className="font-semibold text-white text-sm leading-tight flex items-center gap-1.5">
                                                            {p.full_name || p.username}
                                                            {p.is_verified && (
                                                                <VerifiedBadge color={badgeHex} tickColor={p.verification_badge_tick_color || undefined} size={14} />
                                                            )}
                                                            {p.user_type && (
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${USER_TYPE_COLORS[p.user_type] || USER_TYPE_COLORS.user}`}>{p.user_type}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">ID: <span className="font-mono text-gray-400">{p.readable_user_id}</span></div>
                                                        <div className="text-xs text-gray-600 mt-0.5">{p.email}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Plan */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    {isBadgeOnly ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border border-green-500/30 bg-green-500/10 text-green-400">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                                            Badge Only
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border" style={{ color: hex, borderColor: hex + "55", backgroundColor: hex + "18" }}>
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />
                                                            {p.plan_name}
                                                        </span>
                                                    )}
                                                    {isFreeAssign && (
                                                        <span className="text-[10px] text-purple-400 bg-purple-400/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-widest">Admin</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Price */}
                                            <td className="px-5 py-4">
                                                {isBadgeOnly
                                                    ? <span className="text-purple-400 font-semibold text-sm">Free</span>
                                                    : isFreeAssign
                                                        ? <span className="text-purple-400 font-semibold text-sm">Free</span>
                                                        : <span className="text-white font-semibold text-sm">{parseFloat(p.price_paid).toLocaleString()}<span className="text-gray-500 text-xs ml-0.5">G</span></span>}
                                            </td>

                                            {/* Started */}
                                            <td className="px-5 py-4 text-gray-400 text-xs">
                                                {isBadgeOnly ? (
                                                    <span className="text-gray-600">—</span>
                                                ) : (
                                                    <>
                                                        <div>{formatDate(p.started_at)}</div>
                                                        <div className="text-gray-600 mt-0.5">{timeAgo(p.started_at)}</div>
                                                    </>
                                                )}
                                            </td>

                                            {/* Expires */}
                                            <td className="px-5 py-4">
                                                {isBadgeOnly ? (
                                                    <span className="text-xs text-purple-400 flex items-center gap-1"><IonIcon name="infinite-outline" className="text-sm" />Lifetime</span>
                                                ) : p.expires_at ? (
                                                    <div>
                                                        <div className={`text-xs font-medium ${expiring ? "text-orange-400" : "text-gray-300"}`}>{formatDate(p.expires_at)}</div>
                                                        {expiring && <div className="text-[10px] text-orange-500 mt-0.5 flex items-center gap-1"><IonIcon name="warning-outline" className="text-xs" />Expiring soon</div>}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-purple-400 flex items-center gap-1"><IonIcon name="infinite-outline" className="text-sm" />Lifetime</span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-4">
                                                {isBadgeOnly ? (
                                                    <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border text-green-400 bg-green-400/10 border-green-500/20">
                                                        <span className="w-2 h-2 rounded-full bg-green-400" />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleToggleStatus(p)}
                                                        disabled={toggling}
                                                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${isActive ? "text-green-400 bg-green-400/10 border-green-500/20 hover:bg-green-400/20" : "text-gray-500 bg-white/5 border-white/10 hover:bg-white/10"}`}
                                                        title={isActive ? "Click to cancel" : "Click to activate"}
                                                    >
                                                        {toggling
                                                            ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                                            : <span className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400" : "bg-gray-600"}`} />}
                                                        {isActive ? "Active" : "Cancelled"}
                                                    </button>
                                                )}
                                            </td>

                                            {/* Per-row Assign button */}
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={() => openRowModal(p)}
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 hover:text-white transition-all"
                                                >
                                                    <IonIcon name="shield-checkmark-outline" className="text-sm" />
                                                    Assign
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Shared Assign Modal (used by both "Assign User" button and per-row "Assign") ── */}
            {modal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">

                        {/* Step 1 — Search user */}
                        {modal.step === 'search_user' && (<>
                            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#1a1a1a] shrink-0">
                                <div>
                                    <h3 className="text-white font-bold">Assign User</h3>
                                    <p className="text-gray-500 text-xs mt-0.5">Search by username, name, email or user ID</p>
                                </div>
                                <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <IonIcon name="close-outline" className="text-lg text-gray-400" />
                                </button>
                            </div>
                            <div className="px-6 py-4 flex flex-col gap-3 overflow-y-auto flex-1">
                                <div className="relative">
                                    <IonIcon name="search-outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                                    <input type="text" placeholder="Username, name, email or user ID…" autoFocus
                                        value={modal.userSearchQuery}
                                        onChange={e => setModal(m => ({ ...m, userSearchQuery: e.target.value }))}
                                        className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-white/30 placeholder-gray-600" />
                                </div>
                                {modal.userSearchLoading && <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>}
                                {!modal.userSearchLoading && !modal.userSearchQuery.trim() && (
                                    <div className="text-center py-8 text-gray-600 text-sm">
                                        <IonIcon name="person-outline" className="text-3xl mb-2 block mx-auto" />
                                        Type to search users
                                    </div>
                                )}
                                {!modal.userSearchLoading && modal.userSearchQuery.trim() && modal.userResults.length === 0 && (
                                    <div className="text-center py-6 text-gray-500 text-sm">No users found</div>
                                )}
                                {modal.userResults.length > 0 && (
                                    <div className="space-y-1.5">
                                        {modal.userResults.map(u => (
                                            <button key={u.id} onClick={() => handleSelectUser(u)}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] hover:border-white/20 transition-colors text-left">
                                                <div className="w-9 h-9 rounded-full bg-[#222] overflow-hidden shrink-0 flex items-center justify-center">
                                                    {u.profile_picture ? <img src={u.profile_picture} alt="" className="w-full h-full object-cover" /> : <IonIcon name="person-outline" className="text-gray-500 text-base" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-white text-sm truncate">{u.full_name || u.username}</div>
                                                    <div className="text-xs text-gray-500 truncate">@{u.username}{u.user_id && <span className="ml-2 font-mono text-gray-600">#{u.user_id}</span>}</div>
                                                    {u.email && <div className="text-xs text-gray-600 truncate">{u.email}</div>}
                                                </div>
                                                <IonIcon name="chevron-forward-outline" className="text-gray-600 text-sm shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="px-6 pb-6 pt-4 border-t border-[#1a1a1a] shrink-0">
                                <button onClick={closeModal} className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
                            </div>
                        </>)}

                    </div>
                </div>
            )}

            {/* ── Per-row Assign Modal — reuses shared modal ── */}
            {rowModal.open && rowModal.purchase && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#1a1a1a] shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#1a1a1a] overflow-hidden shrink-0 flex items-center justify-center">
                                    {rowModal.purchase.profile_picture ? <img src={rowModal.purchase.profile_picture} alt="" className="w-full h-full object-cover" /> : <IonIcon name="person-outline" className="text-gray-500 text-base" />}
                                </div>
                                <div>
                                    <div className="text-white font-bold text-sm">{rowModal.purchase.full_name || rowModal.purchase.username}</div>
                                    <div className="text-gray-500 text-xs">@{rowModal.purchase.username} · ID {rowModal.purchase.readable_user_id}</div>
                                </div>
                            </div>
                            <button onClick={() => setRowModal(EMPTY_ROW_MODAL)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                <IonIcon name="close-outline" className="text-lg text-gray-400" />
                            </button>
                        </div>
                        <div className="flex border-b border-[#1a1a1a] shrink-0">
                            {(['badge', 'plan'] as const).map(t => (
                                <button key={t} onClick={() => setRowModal(m => ({ ...m, tab: t }))}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 ${rowModal.tab === t ? "text-white border-white" : "text-gray-500 border-transparent hover:text-gray-300"}`}>
                                    <IonIcon name={t === 'badge' ? "shield-checkmark-outline" : "card-outline"} className="text-base" />
                                    {t === 'badge' ? 'Verification Badge' : 'Free Plan'}
                                </button>
                            ))}
                        </div>
                        {rowModal.tab === 'badge' && (
                            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
                                <div className="flex items-center justify-between bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3">
                                    <div>
                                        <div className="text-sm font-semibold text-white">Assign Verified Badge</div>
                                        <div className="text-xs text-gray-500 mt-0.5">Shows a verification checkmark on user profile</div>
                                    </div>
                                    <button onClick={() => setRowModal(m => ({ ...m, is_verified: !m.is_verified }))}
                                        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${rowModal.is_verified ? "bg-green-500" : "bg-[#2a2a2a]"}`}>
                                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${rowModal.is_verified ? "left-7" : "left-1"}`} />
                                    </button>
                                </div>
                                {rowModal.is_verified && (
                                    <div className="space-y-3">
                                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Badge Color</div>
                                        <div className="grid grid-cols-5 gap-2">
                                            {COLOR_OPTIONS.map(c => {
                                                const sel = rowModal.badge_color === c.value;
                                                return (
                                                    <button key={c.value} onClick={() => setRowModal(m => ({ ...m, badge_color: c.value }))}
                                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${sel ? "border-white/50 bg-white/10" : "border-[#2a2a2a] hover:border-white/20"}`} title={c.label}>
                                                        <div className="w-6 h-6 rounded-full" style={{ background: (c.hex === '#ef4444' || c.hex === '#3d3d3d') ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 65%), ${c.hex}` : c.hex }} />
                                                        <span className="text-[9px] text-gray-500 capitalize">{c.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {/* Custom color box + save */}
                                        <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3">
                                            <label className="text-xs text-gray-400 shrink-0">Custom:</label>
                                            <label className="relative cursor-pointer shrink-0">
                                                <input type="color"
                                                    value={customHexInput.length === 7 ? customHexInput : resolveColor(rowModal.badge_color)}
                                                    onChange={e => { setCustomHexInput(e.target.value); setRowModal(m => ({ ...m, badge_color: e.target.value })); }}
                                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                                                <div className="w-8 h-8 rounded-lg border-2 border-white/20 cursor-pointer"
                                                    style={{ backgroundColor: customHexInput.length === 7 ? customHexInput : resolveColor(rowModal.badge_color) }} />
                                            </label>
                                            <input type="text"
                                                value={customHexInput || resolveColor(rowModal.badge_color)}
                                                onChange={e => { const v = e.target.value; setCustomHexInput(v); if (v.match(/^#[0-9a-fA-F]{6}$/)) setRowModal(m => ({ ...m, badge_color: v })); }}
                                                className="flex-1 bg-transparent text-white text-xs font-mono focus:outline-none border-b border-[#2a2a2a] focus:border-white/40 pb-0.5" maxLength={7} placeholder="#ffffff" />
                                            <button type="button"
                                                onClick={() => {
                                                    const hex = customHexInput.length === 7 ? customHexInput : resolveColor(rowModal.badge_color);
                                                    if (!hex.match(/^#[0-9a-fA-F]{6}$/)) return;
                                                    const next = saveCustomColor(hex);
                                                    setSavedColors(next);
                                                    setSavedColorPage(0);
                                                    setRowModal(m => ({ ...m, badge_color: hex }));
                                                    setCustomHexInput('');
                                                }}
                                                className="shrink-0 text-[10px] font-bold text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors">
                                                Save
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3">
                                            <label className="text-xs text-gray-400 shrink-0">badge_tick_color:</label>
                                            <label className="relative cursor-pointer shrink-0">
                                                <input type="color"
                                                    value={rowModal.badge_tick_color && rowModal.badge_tick_color.match(/^#[0-9a-fA-F]{6}$/) ? rowModal.badge_tick_color : resolveTickColor(resolveColor(rowModal.badge_color))}
                                                    onChange={e => setRowModal(m => ({ ...m, badge_tick_color: e.target.value }))}
                                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                                                <div className="w-8 h-8 rounded-lg border-2 border-white/20 cursor-pointer"
                                                    style={{ backgroundColor: rowModal.badge_tick_color || resolveTickColor(resolveColor(rowModal.badge_color)) }} />
                                            </label>
                                            <input type="text"
                                                value={rowModal.badge_tick_color || ''}
                                                onChange={e => {
                                                    const v = e.target.value;
                                                    if (v === '' || v.match(/^#[0-9a-fA-F]{0,6}$/)) setRowModal(m => ({ ...m, badge_tick_color: v }));
                                                }}
                                                className="flex-1 bg-transparent text-white text-xs font-mono focus:outline-none border-b border-[#2a2a2a] focus:border-white/40 pb-0.5"
                                                maxLength={7}
                                                placeholder={resolveTickColor(resolveColor(rowModal.badge_color))} />
                                            <button type="button"
                                                onClick={() => setRowModal(m => ({ ...m, badge_tick_color: '' }))}
                                                className="shrink-0 text-[10px] font-bold text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors">
                                                Auto
                                            </button>
                                        </div>

                                        {/* Saved custom colors with pagination */}
                                        {savedColors.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-gray-600 uppercase tracking-wider">Saved Colors</span>
                                                    {savedColors.length > SAVED_PAGE_SIZE && (
                                                        <div className="flex items-center gap-1">
                                                            <button type="button" disabled={savedColorPage === 0} onClick={() => setSavedColorPage(p => p - 1)}
                                                                className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-white disabled:opacity-30 transition-colors">
                                                                <IonIcon name="chevron-back-outline" className="text-xs" />
                                                            </button>
                                                            <span className="text-[9px] text-gray-600">{savedColorPage + 1}/{Math.ceil(savedColors.length / SAVED_PAGE_SIZE)}</span>
                                                            <button type="button" disabled={(savedColorPage + 1) * SAVED_PAGE_SIZE >= savedColors.length} onClick={() => setSavedColorPage(p => p + 1)}
                                                                className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-white disabled:opacity-30 transition-colors">
                                                                <IonIcon name="chevron-forward-outline" className="text-xs" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {savedColors.slice(savedColorPage * SAVED_PAGE_SIZE, (savedColorPage + 1) * SAVED_PAGE_SIZE).map((hex, i) => {
                                                        const sel = resolveColor(rowModal.badge_color).toLowerCase() === hex.toLowerCase();
                                                        return (
                                                            <div key={hex + i} className="relative group">
                                                                <button type="button"
                                                                    onClick={() => { setRowModal(m => ({ ...m, badge_color: hex })); setCustomHexInput(hex); }}
                                                                    className={`w-full flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${sel ? 'border-white/50 bg-white/10' : 'border-[#2a2a2a] hover:border-white/20'}`}
                                                                    title={hex}>
                                                                    <div className="w-6 h-6 rounded-full" style={{ background: (hex === '#ef4444' || hex === '#3d3d3d') ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 65%), ${hex}` : hex }} />
                                                                    <span className="text-[8px] text-gray-600 font-mono">{hex}</span>
                                                                </button>
                                                                <button
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        const next = removeCustomColor(hex);
                                                                        setSavedColors(next);
                                                                        const maxPage = Math.max(0, Math.ceil(next.length / SAVED_PAGE_SIZE) - 1);
                                                                        if (savedColorPage > maxPage) setSavedColorPage(maxPage);
                                                                    }}
                                                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1a1a1a] border border-[#333] text-gray-500 hover:text-red-400 hover:border-red-500/40 hidden group-hover:flex items-center justify-center text-[9px] transition-colors"
                                                                    title="Remove"
                                                                >✕</button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3">
                                            <span className="text-xs text-gray-500">Preview:</span>
                                            <div className="flex items-center gap-1.5">
                                                <VerifiedBadge color={resolveColor(rowModal.badge_color)} tickColor={rowModal.badge_tick_color} size={20} />
                                                <span className="text-xs font-semibold" style={{ color: resolveColor(rowModal.badge_color) }}>Verified</span>
                                            </div>
                                            <span className="text-[10px] text-gray-600">— shown on profile &amp; next to username</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {rowModal.tab === 'plan' && (
                            <div className="px-6 py-4 flex flex-col gap-3 overflow-y-auto flex-1">
                                <p className="text-xs text-gray-500">Assign any paid plan free. Their current plan will be replaced.</p>
                                <div className="relative">
                                    <IonIcon name="search-outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                                    <input type="text" placeholder="Filter plans…" value={rowModal.planSearch}
                                        onChange={e => setRowModal(m => ({ ...m, planSearch: e.target.value }))}
                                        className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-white/30 placeholder-gray-600" />
                                </div>
                                <div className="space-y-2">
                                    {plans.filter(p => p.name.toLowerCase().includes(rowModal.planSearch.toLowerCase())).map(plan => {
                                        const hex = resolveColor(plan.badge_color);
                                        const sel = rowModal.selectedPlanId === plan.id;
                                        return (
                                            <button key={plan.id} onClick={() => setRowModal(m => ({ ...m, selectedPlanId: sel ? null : plan.id }))}
                                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left ${sel ? "border-white/30 bg-white/5" : "border-[#2a2a2a] bg-[#111] hover:bg-[#161616] hover:border-white/10"}`}>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${sel ? "border-white bg-white" : "border-[#3a3a3a]"}`}>
                                                    {sel && <IonIcon name="checkmark-outline" className="text-black text-xs" />}
                                                </div>
                                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-white text-sm">{plan.name}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">{plan.extra?.is_lifetime_plan || plan.duration_days === 0 ? "Lifetime" : `${plan.duration_days} days`}{plan.verified_tick && <span className="ml-2 text-green-400">· Verified tick</span>}</div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-white font-bold text-sm">{parseFloat(plan.price).toLocaleString()}<span className="text-gray-500 text-xs ml-0.5">G</span></div>
                                                    <div className="text-[10px] text-purple-400 font-medium mt-0.5">Free assign</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {plans.filter(p => p.name.toLowerCase().includes(rowModal.planSearch.toLowerCase())).length === 0 && <div className="text-center py-6 text-gray-500 text-sm">No plans match</div>}
                                </div>
                            </div>
                        )}
                        <div className="px-6 pb-6 pt-4 border-t border-[#1a1a1a] shrink-0 flex gap-3">
                            <button onClick={() => setRowModal(EMPTY_ROW_MODAL)} disabled={rowModal.saving} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50">Cancel</button>
                            {rowModal.tab === 'badge' && (
                                <button onClick={handleSaveRowBadge} disabled={rowModal.saving}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    {rowModal.saving ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <><IonIcon name="checkmark-outline" className="text-base" />Save Badge</>}
                                </button>
                            )}
                            {rowModal.tab === 'plan' && (
                                <button onClick={handleSaveRowPlan} disabled={!rowModal.selectedPlanId || rowModal.saving}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                                    {rowModal.saving ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <><IonIcon name="checkmark-outline" className="text-base" />Assign Free</>}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
