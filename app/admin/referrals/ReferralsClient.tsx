"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

// ── Types ─────────────────────────────────────────────────────────────────────

type RefLevel = {
    id?: number;
    level: number;
    name: string;
    commission_percentage: number | string;
    ad_commission_percentage: number | string;
    is_active: boolean;
    sort_order: number;
    _isNew?: boolean;
};

type CommissionSettings = {
    product_purchase_pool_percentage: number | string;
    ad_purchase_pool_percentage: number | string;
};

type Stats = {
    total_users: number;
    total_referrals: number;
    total_commission: number;
    pending_withdrawals: number;
    googer_commission_earned?: number;
};

type MappedUser = {
    id: number;
    username: string;
    full_name: string;
    user_code: string;
    profile_picture?: string;
    referred_by?: number;
    referred_by_username?: string;
    referred_by_full_name?: string;
    referral_code_used?: string;
    referral_date?: string;
    registered_at?: string;
    total_commission?: number;
};

type MappingLevel = {
    level: number;
    level_name: string;
    is_admin_only?: boolean;
    users: MappedUser[];
};

type LeaderUser = {
    id: number;
    username: string;
    full_name: string;
    user_code: string;
    profile_picture?: string;
    referral_count: number;
    total_earned: number;
};

type BuyerLineStep = {
    depth: number;
    id: number;
    username: string;
    full_name: string;
    user_code: string;
    profile_picture?: string;
    level_name?: string;
    commission_percentage: number;
    ad_commission_percentage: number;
    is_active: boolean;
};

type BuyerLine = {
    buyer: { id: number; username: string; full_name: string; user_code: string; profile_picture?: string; registered_at?: string };
    upline: BuyerLineStep[];
};

type PreviewStep = {
    depth: number;
    level_name: string;
    user: { id: number; username: string; full_name: string; user_code: string; profile_picture?: string } | null;
    is_root?: boolean;
    commission_percentage: number;
    amount_earned: number;
};

type CommissionPreview = {
    buyer: { id: number; username: string; full_name: string; user_code: string };
    transaction_type: string;
    amount: number;
    pool_percentage: number;
    pool_amount: number;
    distribution: PreviewStep[];
};

type PayoutRecord = {
    id: number;
    source_type: string;
    source_id?: number;
    pool_amount: number;
    commission_percentage: number;
    amount_paid: number;
    level: number;
    created_at: string;
    buyer_id?: number;
    buyer_username?: string;
    buyer_full_name?: string;
    earner_id?: number;
    earner_username?: string;
    earner_full_name?: string;
};

// ── Colour palettes ───────────────────────────────────────────────────────────

const LEVEL_COLORS = [
    { bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-400' }, // 0 Googer
    { bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   text: 'text-blue-400'   }, // 1
    { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400' }, // 2
    { bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  text: 'text-amber-400'  }, // 3
    { bg: 'bg-green-500/15',  border: 'border-green-500/30',  text: 'text-green-400'  }, // 4
    { bg: 'bg-red-500/15',    border: 'border-red-500/30',    text: 'text-red-400'    }, // 5
    { bg: 'bg-teal-500/15',   border: 'border-teal-500/30',   text: 'text-teal-400'   }, // 6
    { bg: 'bg-pink-500/15',   border: 'border-pink-500/30',   text: 'text-pink-400'   }, // 7
    { bg: 'bg-lime-500/15',   border: 'border-lime-500/30',   text: 'text-lime-400'   }, // 8
];
const lc = (level: number) => LEVEL_COLORS[level % LEVEL_COLORS.length];

const BRANCH_PALETTE = [
    '#3b82f6', '#a855f7', '#f59e0b', '#22c55e',
    '#ef4444', '#14b8a6', '#ec4899', '#84cc16',
];

function buildBranchColorMap(mapping: MappingLevel[]): Map<number, string> {
    const colorMap = new Map<number, string>();
    const parentOf  = new Map<number, number>();

    for (const lvl of mapping) {
        for (const u of lvl.users) {
            if (u.referred_by != null) parentOf.set(u.id, u.referred_by);
        }
    }

    const level1Users = mapping.find(l => l.level === 1)?.users ?? [];
    level1Users.forEach((u, i) => colorMap.set(u.id, BRANCH_PALETTE[i % BRANCH_PALETTE.length]));

    function resolve(uid: number, visited = new Set<number>()): string {
        if (colorMap.has(uid)) return colorMap.get(uid)!;
        if (visited.has(uid)) return BRANCH_PALETTE[0];
        visited.add(uid);
        const parent = parentOf.get(uid);
        if (parent == null) return BRANCH_PALETTE[0];
        const c = resolve(parent, visited);
        colorMap.set(uid, c);
        return c;
    }

    for (const lvl of mapping) {
        for (const u of lvl.users) {
            if (!colorMap.has(u.id)) resolve(u.id);
        }
    }
    return colorMap;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const fmtG    = (n: number) => `G ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN    = (n: number) => Number(n || 0).toLocaleString('en-US');
const fmtDate = (s?: string) => {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return s; }
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sz = size === 'sm' ? 'w-4 h-4 border' : size === 'lg' ? 'w-10 h-10 border-2' : 'w-7 h-7 border-2';
    return <div className={`${sz} border-white/20 border-t-white rounded-full animate-spin`} />;
}

function Avatar({ user, size = 8 }: { user: { username?: string; full_name?: string; profile_picture?: string }; size?: number }) {
    const initial = (user.full_name || user.username || '?').charAt(0).toUpperCase();
    const cls = `w-${size} h-${size} rounded-full object-cover border border-white/10 shrink-0`;
    if (user.profile_picture && (user.profile_picture.startsWith('http') || user.profile_picture.startsWith('data:'))) {
        return <img src={user.profile_picture} alt={user.username} className={cls} />;
    }
    return (
        <div className={`w-${size} h-${size} rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0`}>
            {initial}
        </div>
    );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
    return (
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-5 flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <IonIcon name={icon} className="text-xl" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{label}</p>
                <p className="text-2xl font-black text-white mt-0.5 leading-tight">{value}</p>
            </div>
        </div>
    );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => onChange(!on)}>
            <div className={`relative w-9 h-5 rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-[#2a2a2a]'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className={`text-xs font-semibold ${on ? 'text-green-400' : 'text-gray-600'}`}>{on ? 'On' : 'Off'}</span>
        </div>
    );
}

// ── Buyer Line Drawer ─────────────────────────────────────────────────────────

function BuyerLineDrawer({
    open, loading, data, poolSettings, onClose,
}: {
    open: boolean;
    loading: boolean;
    data: BuyerLine | null;
    poolSettings: CommissionSettings;
    onClose: () => void;
}) {
    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer */}
            <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#0d0d0d] border-l border-[#1f1f1f] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <IonIcon name="git-branch-outline" className="text-blue-400 text-sm" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white">Buyer Line</h2>
                            <p className="text-[10px] text-gray-500">Commission upline path</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <IonIcon name="close-outline" className="text-xl" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>
                ) : !data ? (
                    <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">No data</div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

                        {/* Buyer */}
                        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-4">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-3">Buyer</p>
                            <div className="flex items-center gap-3">
                                <Avatar user={data.buyer} size={10} />
                                <div>
                                    <p className="text-sm font-bold text-white">{data.buyer.full_name || data.buyer.username}</p>
                                    <p className="text-[11px] text-gray-500">@{data.buyer.username}</p>
                                    <p className="text-[10px] text-gray-600 font-mono mt-0.5">ID: {data.buyer.user_code || data.buyer.id}</p>
                                </div>
                            </div>
                        </div>

                        {/* Upline path */}
                        <div>
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-3">Upline Commission Path</p>

                            {data.upline.length === 0 ? (
                                <p className="text-sm text-gray-600 italic px-1">This user has no referral upline.</p>
                            ) : (
                                <div className="space-y-2">
                                    {data.upline.map((step, i) => {
                                        const c = lc(step.depth);
                                        return (
                                            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${c.bg} ${c.border}`}>
                                                {/* Connector */}
                                                <div className="flex flex-col items-center shrink-0">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>
                                                        L{step.depth}
                                                    </span>
                                                    {i < data.upline.length - 1 && (
                                                        <div className="w-px h-3 bg-white/10 mt-1" />
                                                    )}
                                                </div>

                                                {/* User */}
                                                <Avatar user={step} size={8} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-semibold truncate ${c.text}`}>
                                                        {step.full_name || step.username}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500">@{step.username}</p>
                                                    {step.level_name && (
                                                        <p className="text-[10px] text-gray-600">{step.level_name}</p>
                                                    )}
                                                </div>

                                                {/* Commission rates */}
                                                <div className="text-right shrink-0">
                                                    <p className={`text-xs font-black ${c.text}`}>
                                                        {step.commission_percentage}%
                                                    </p>
                                                    <p className="text-[10px] text-gray-600">Pro</p>
                                                    {Number(step.ad_commission_percentage) > 0 && (
                                                        <>
                                                            <p className={`text-xs font-bold ${c.text} mt-0.5`}>
                                                                {step.ad_commission_percentage}%
                                                            </p>
                                                            <p className="text-[10px] text-gray-600">Ad</p>
                                                        </>
                                                    )}
                                                    {!step.is_active && (
                                                        <span className="text-[9px] text-red-400/70 uppercase font-bold">inactive</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Root */}
                        <div className="flex items-center gap-3 p-3 rounded-xl border bg-yellow-500/5 border-yellow-500/20">
                            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-yellow-500/15 border border-yellow-500/30 shrink-0">
                                <IonIcon name="star-outline" className="text-yellow-400 text-sm" />
                            </span>
                            <div>
                                <p className="text-xs font-bold text-yellow-400">Googer Level</p>
                                <p className="text-[10px] text-yellow-600 uppercase tracking-widest font-bold">Root</p>
                            </div>
                        </div>

                        {/* Pool info */}
                        <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
                            <IonIcon name="information-circle-outline" className="text-blue-400 text-base shrink-0 mt-0.5" />
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                                Pool: <span className="text-white font-semibold">{poolSettings.product_purchase_pool_percentage}%</span> of product purchase ·{' '}
                                <span className="text-white font-semibold">{poolSettings.ad_purchase_pool_percentage}%</span> of ad purchase.
                                Each level&apos;s % applies to the pool amount.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'commission' | 'mapping' | 'earners';

export default function ReferralsClient() {
    const [tab, setTab] = useState<Tab>('commission');
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    // Commission pool
    const [poolSettings,    setPoolSettings]    = useState<CommissionSettings>({ product_purchase_pool_percentage: 20, ad_purchase_pool_percentage: 20 });
    const [loadingPool,     setLoadingPool]     = useState(true);
    const [savingPool,      setSavingPool]      = useState(false);

    // Level distribution
    const [levels,          setLevels]          = useState<RefLevel[]>([]);
    const [editedLevels,    setEditedLevels]    = useState<RefLevel[]>([]);
    const [loadingLevels,   setLoadingLevels]   = useState(true);
    const [savingIds,       setSavingIds]       = useState<Set<number | string>>(new Set());
    const [deletingLevel,   setDeletingLevel]   = useState<number | null>(null);
    const [savingAll,       setSavingAll]       = useState(false);

    // Stats + mapping + earners
    const [stats,           setStats]           = useState<Stats | null>(null);
    const [mapping,         setMapping]         = useState<MappingLevel[]>([]);
    const [topEarners,      setTopEarners]      = useState<LeaderUser[]>([]);
    const [topReferrers,    setTopReferrers]    = useState<LeaderUser[]>([]);
    const [loadingStats,    setLoadingStats]    = useState(true);
    const [loadingMapping,  setLoadingMapping]  = useState(true);
    const [loadingEarners,  setLoadingEarners]  = useState(true);
    const [collapsed,       setCollapsed]       = useState<Set<number>>(new Set());

    // Buyer line drawer
    const [drawerOpen,      setDrawerOpen]      = useState(false);
    const [drawerLoading,   setDrawerLoading]   = useState(false);
    const [drawerData,      setDrawerData]      = useState<BuyerLine | null>(null);

    // Commission preview tool
    const [previewBuyerId,  setPreviewBuyerId]  = useState('');
    const [previewType,     setPreviewType]     = useState<'product' | 'ad'>('product');
    const [previewAmount,   setPreviewAmount]   = useState('');
    const [previewLoading,  setPreviewLoading]  = useState(false);
    const [previewResult,   setPreviewResult]   = useState<CommissionPreview | null>(null);
    const [previewError,    setPreviewError]    = useState('');

    // Payout history
    const [payouts,         setPayouts]         = useState<PayoutRecord[]>([]);
    const [payoutsTotal,    setPayoutsTotal]    = useState(0);
    const [payoutsPage,     setPayoutsPage]     = useState(1);
    const [loadingPayouts,  setLoadingPayouts]  = useState(false);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    // ── Loaders ───────────────────────────────────────────────────────────────

    const loadPool = useCallback(async () => {
        setLoadingPool(true);
        try {
            const res = await adminService.fetchRefCommissionSettings();
            const source = res.data || res.settings || res;
            setPoolSettings({
                product_purchase_pool_percentage:
                    source.product_purchase_pool_percentage ?? source.productPurchasePoolPercentage ?? 20,
                ad_purchase_pool_percentage:
                    source.ad_purchase_pool_percentage ?? source.adPurchasePoolPercentage ?? 20,
            });
        } catch { /* silent */ }
        finally { setLoadingPool(false); }
    }, []);

    const loadLevels = useCallback(async (silent = false) => {
        if (!silent) setLoadingLevels(true);
        try {
            const res = await adminService.fetchRefLevels();
            let data: RefLevel[] = res.data || res.levels || [];
            // Ensure fixed system levels are always present at the top.
            if (!data.find(l => l.level === 0)) {
                data = [
                    { level: 0, name: 'Googer', commission_percentage: 0, ad_commission_percentage: 0, is_active: true, sort_order: 0 },
                    ...data,
                ];
            }
            if (!data.find(l => l.level === 99)) {
                const rootIndex = data.findIndex(l => l.level === 0);
                const buyerLevel = { level: 99, name: 'Buyer', commission_percentage: 0, ad_commission_percentage: 0, is_active: true, sort_order: 1, _isNew: true };
                data = rootIndex >= 0
                    ? [...data.slice(0, rootIndex + 1), buyerLevel, ...data.slice(rootIndex + 1)]
                    : [buyerLevel, ...data];
            }
            const defaultLevels = [
                { level: 1, name: 'Direct', commission_percentage: 40, ad_commission_percentage: 0, is_active: true, sort_order: 2, _isNew: true },
                { level: 2, name: 'Team', commission_percentage: 20, ad_commission_percentage: 0, is_active: true, sort_order: 3, _isNew: true },
                { level: 3, name: 'Network', commission_percentage: 10, ad_commission_percentage: 0, is_active: true, sort_order: 4, _isNew: true },
                { level: 4, name: 'Extended', commission_percentage: 5, ad_commission_percentage: 0, is_active: true, sort_order: 5, _isNew: true },
                { level: 5, name: 'Global', commission_percentage: 3, ad_commission_percentage: 0, is_active: true, sort_order: 6, _isNew: true },
                { level: 6, name: 'Level 6', commission_percentage: 2, ad_commission_percentage: 0, is_active: true, sort_order: 7, _isNew: true },
            ];
            for (const defaultLevel of defaultLevels) {
                if (!data.find(l => l.level === defaultLevel.level)) data.push(defaultLevel);
            }
            data = data.sort((a, b) => {
                const rank = (level: number) => level === 0 ? 0 : level === 99 ? 1 : level + 1;
                return rank(a.level) - rank(b.level);
            });
            setLevels(data);
            setEditedLevels(data.map(l => ({ ...l })));
        } catch { /* silent */ }
        finally { if (!silent) setLoadingLevels(false); }
    }, []);

    const loadStats = useCallback(async () => {
        try {
            const res = await adminService.fetchReferralStats();
            setStats(res.data);
        } catch { /* silent */ }
        finally { setLoadingStats(false); }
    }, []);

    const loadMapping = useCallback(async () => {
        try {
            const res = await adminService.fetchReferralMapping();
            setMapping(res.data || []);
        } catch { /* silent */ }
        finally { setLoadingMapping(false); }
    }, []);

    const loadEarners = useCallback(async () => {
        try {
            const [e, r] = await Promise.all([
                adminService.fetchTopEarners(10),
                adminService.fetchTopReferrers(10),
            ]);
            setTopEarners(e.data || []);
            setTopReferrers(r.data || []);
        } catch { /* silent */ }
        finally { setLoadingEarners(false); }
    }, []);

    const loadPayouts = useCallback(async (page = 1) => {
        setLoadingPayouts(true);
        try {
            const res = await adminService.fetchCommissionPayouts(page, 20);
            setPayouts(res.data || []);
            setPayoutsTotal(res.total || 0);
            setPayoutsPage(page);
        } catch { /* silent */ }
        finally { setLoadingPayouts(false); }
    }, []);

    const loadAll = useCallback(() => {
        loadPool();
        loadLevels();
        loadStats();
        loadMapping();
        loadEarners();
    }, [loadPool, loadLevels, loadStats, loadMapping, loadEarners]);

    useEffect(() => {
        loadAll();
        loadPayouts(1);
        pollRef.current = setInterval(() => {
            loadLevels(true);
            loadStats();
            loadMapping();
            loadEarners();
        }, 30_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [loadAll, loadLevels, loadStats, loadMapping, loadEarners, loadPayouts]);

    // ── Buyer line ────────────────────────────────────────────────────────────

    const openBuyerLine = async (userId: number) => {
        setDrawerOpen(true);
        setDrawerData(null);
        setDrawerLoading(true);
        try {
            const res = await adminService.fetchBuyerLine(userId);
            setDrawerData(res.data);
        } catch { /* silent */ }
        finally { setDrawerLoading(false); }
    };

    // ── Commission preview ────────────────────────────────────────────────────

    const handlePreview = async () => {
        setPreviewError('');
        setPreviewResult(null);
        const id = parseInt(previewBuyerId, 10);
        const amt = parseFloat(previewAmount);
        if (!id || isNaN(id)) { setPreviewError('Enter a valid buyer user ID'); return; }
        if (!amt || amt <= 0)  { setPreviewError('Enter a positive amount'); return; }
        setPreviewLoading(true);
        try {
            const res = await adminService.previewCommission(id, previewType, amt);
            setPreviewResult(res.data);
        } catch (err: any) {
            setPreviewError(err.message || 'Preview failed');
        } finally {
            setPreviewLoading(false);
        }
    };

    // ── Pool save ─────────────────────────────────────────────────────────────

    const handleSavePool = async () => {
        setSavingPool(true);
        try {
            const res = await adminService.updateRefCommissionSettings({
                productPurchasePoolPercentage: Number(poolSettings.product_purchase_pool_percentage) || 0,
                adPurchasePoolPercentage:      Number(poolSettings.ad_purchase_pool_percentage) || 0,
            });
            const source = res.data || res.settings || res;
            setPoolSettings({
                product_purchase_pool_percentage:
                    source.product_purchase_pool_percentage ?? source.productPurchasePoolPercentage ?? (Number(poolSettings.product_purchase_pool_percentage) || 0),
                ad_purchase_pool_percentage:
                    source.ad_purchase_pool_percentage ?? source.adPurchasePoolPercentage ?? (Number(poolSettings.ad_purchase_pool_percentage) || 0),
            });
            showToast('success', 'Commission pool settings saved');
        } catch (err: any) {
            showToast('error', err.message || 'Failed to save');
        } finally {
            setSavingPool(false);
        }
    };

    // ── Level editor helpers ──────────────────────────────────────────────────

    const setField = (idx: number, field: keyof RefLevel, value: any) =>
        setEditedLevels(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));

    const addLocalLevel = () => {
        const normalLevels = editedLevels.filter(l => l.level > 0 && l.level !== 99);
        const maxLvl  = normalLevels.reduce((m, l) => Math.max(m, l.level), 0);
        const maxSort = editedLevels.reduce((m, l) => Math.max(m, l.sort_order), 0);
        const n = maxLvl + 1;
        setEditedLevels(prev => [...prev, {
            level: n, name: `Level ${n}`, commission_percentage: 2,
            ad_commission_percentage: 0, is_active: true, sort_order: maxSort + 1, _isNew: true,
        }]);
    };

    const handleSaveRow = async (lvl: RefLevel, idx: number) => {
        if (!String(lvl.name).trim()) { showToast('error', 'Name cannot be empty'); return; }
        const rowKey = lvl._isNew ? `new-${idx}` : lvl.level;
        setSavingIds(s => new Set(s).add(rowKey));
        try {
            await adminService.bulkSaveRefLevels([{
                level: lvl.level, name: String(lvl.name).trim(),
                commission_percentage: Number(lvl.commission_percentage) || 0,
                ad_commission_percentage: Number(lvl.ad_commission_percentage) || 0,
                is_active: lvl.is_active, sort_order: lvl.sort_order,
            }]);
            showToast('success', lvl.level === 99 ? 'Buyer level saved' : `Level ${lvl.level} saved`);
            loadLevels(true);
        } catch (err: any) {
            showToast('error', err.message || 'Failed to save');
        } finally {
            setSavingIds(s => { const n = new Set(s); n.delete(rowKey); return n; });
        }
    };

    const handleSaveAll = async () => {
        if (editedLevels.find(l => !String(l.name).trim())) {
            showToast('error', 'All levels must have a name'); return;
        }
        setSavingAll(true);
        try {
            await adminService.bulkSaveRefLevels(
                editedLevels.map(l => ({
                    level: l.level, name: String(l.name).trim(),
                    commission_percentage: Number(l.commission_percentage) || 0,
                    ad_commission_percentage: Number(l.ad_commission_percentage) || 0,
                    is_active: l.is_active, sort_order: l.sort_order,
                }))
            );
            showToast('success', 'All levels saved');
            loadLevels(true);
        } catch (err: any) {
            showToast('error', err.message || 'Failed to save');
        } finally {
            setSavingAll(false); setSavingIds(new Set());
        }
    };

    const handleDeleteLevel = async (lvl: RefLevel, idx: number) => {
        if (lvl._isNew) { setEditedLevels(prev => prev.filter((_, i) => i !== idx)); return; }
        if (lvl.level === 0 || lvl.level === 99) { showToast('error', 'Cannot delete this fixed level'); return; }
        setDeletingLevel(lvl.level);
        try {
            await adminService.deleteRefLevel(lvl.level);
            showToast('success', `Level ${lvl.level} deleted`);
            loadLevels(true);
        } catch (err: any) {
            showToast('error', err.message || 'Failed to delete');
        } finally {
            setDeletingLevel(null);
        }
    };

    const toggleCollapse = (n: number) =>
        setCollapsed(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });

    // ── Derived mapping stats for Googer Root card ────────────────────────────

    const totalDirectUsers  = mapping.find(l => l.level === 1)?.users.length ?? 0;
    const totalNetworkUsers = mapping.reduce((sum, l) => (l.level > 0 && l.level !== 99) ? sum + l.users.length : sum, 0);

    // ── Tabs ──────────────────────────────────────────────────────────────────

    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: 'commission', label: 'Commission Control', icon: 'settings-outline' },
        { id: 'mapping',    label: 'Referral Mapping',  icon: 'git-network-outline' },
        { id: 'earners',    label: 'Leaderboard',       icon: 'trophy-outline' },
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    const branchColors = buildBranchColorMap(mapping);

    return (
        <div className="p-6 space-y-6">

            {/* Buyer Line Drawer */}
            <BuyerLineDrawer
                open={drawerOpen}
                loading={drawerLoading}
                data={drawerData}
                poolSettings={poolSettings}
                onClose={() => setDrawerOpen(false)}
            />

            {/* Toast */}
            {toast && (
                <div className={`fixed left-1/2 top-4 z-[100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${toast.type === 'success' ? 'bg-green-950/90 border-green-500/30 text-green-200' : 'bg-red-950/90 border-red-500/30 text-red-200'}`}>
                    <IonIcon name={toast.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'} className="text-sm shrink-0" />
                    <span className="truncate">{toast.msg}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Referral Control</h1>
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
                        Manage commission pools, level distribution, and referral mapping
                        <span className="flex items-center gap-1 text-[10px] text-green-500/60 font-medium uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Live
                        </span>
                    </p>
                </div>
                <button onClick={loadAll} className="flex items-center gap-2 border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-white/30 px-3 py-2 rounded-xl text-sm transition-colors">
                    <IonIcon name="refresh-outline" className="text-base" />
                    Refresh
                </button>
            </div>

            {/* Stats row */}
            {!loadingStats && stats && (
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard icon="people-outline"      label="Total Users"         value={fmtN(stats.total_users)}         color="bg-blue-500/10 text-blue-400" />
                    <StatCard icon="git-network-outline" label="Total Referrals"     value={fmtN(stats.total_referrals)}     color="bg-purple-500/10 text-purple-400" />
                    <StatCard icon="cash-outline"        label="Total Commission"    value={fmtG(stats.total_commission)}    color="bg-green-500/10 text-green-400" />
                    <StatCard icon="time-outline"        label="Pending Withdrawals" value={fmtN(stats.pending_withdrawals)} color="bg-amber-500/10 text-amber-400" />
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-1">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${tab === t.id ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>
                        <IonIcon name={t.icon} className="text-base shrink-0" />
                        <span className="hidden sm:inline">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* ════════════════ COMMISSION CONTROL ════════════════ */}
            {tab === 'commission' && (
                <div className="space-y-6">

                    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#1a1a1a]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                                    <IonIcon name="layers-outline" className="text-lg text-purple-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white">Commission Control</h2>
                                    <p className="text-xs text-gray-500">Customize Googer, Buyer, and referral level commissions</p>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={addLocalLevel}
                                    className="flex items-center gap-1.5 text-xs font-semibold border border-[#2a2a2a] text-gray-300 hover:text-white hover:border-white/30 px-3 py-2 rounded-xl transition-colors">
                                    <IonIcon name="add-outline" className="text-sm" />Add Level
                                </button>
                                <button onClick={handleSaveAll} disabled={savingAll || savingIds.size > 0}
                                    className="flex items-center gap-1.5 text-xs font-bold text-black bg-white hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
                                    {savingAll ? <Spinner size="sm" /> : null}Save All
                                </button>
                            </div>
                        </div>

                        {loadingLevels
                            ? <div className="flex justify-center py-10"><Spinner /></div>
                            : (
                                <>
                                    <div className="grid grid-cols-[2.5rem_1fr_8rem_8rem_6rem_3rem_3rem] gap-3 px-6 py-3 border-b border-[#1a1a1a] text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                                        <span>Lvl</span><span>Name</span>
                                        <span>Pro / Wallet Commission</span><span>Ad Commission</span>
                                        <span>Status</span><span></span><span></span>
                                    </div>

                                    {editedLevels.length === 0 && (
                                        <p className="py-10 text-center text-gray-600 text-sm">No levels - click Add Level</p>
                                    )}

                                    {[
                                        ...editedLevels.filter(lvl => lvl.level === 0),
                                        ...editedLevels.filter(lvl => lvl.level === 99),
                                        ...editedLevels.filter(lvl => lvl.level > 0 && lvl.level !== 99),
                                    ].map((lvl) => {
                                        const idx        = editedLevels.findIndex(l => l.level === lvl.level && l._isNew === lvl._isNew);
                                        const isGooger   = lvl.level === 0;
                                        const isBuyer    = lvl.level === 99;
                                        const c          = isBuyer ? { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400' } : lc(lvl.level);
                                        const rowKey     = lvl._isNew ? `new-${idx}` : lvl.level;
                                        const isSaving   = savingIds.has(rowKey);
                                        const isDeleting = deletingLevel === lvl.level;

                                        return (
                                            <div key={rowKey}
                                                className={`grid grid-cols-[2.5rem_1fr_8rem_8rem_6rem_3rem_3rem] gap-3 px-6 py-3 border-b last:border-0 items-center
                                                    ${isGooger ? 'border-yellow-500/20 bg-yellow-500/[0.03]' : isBuyer ? 'border-blue-500/20 bg-blue-500/[0.03]' : 'border-[#111]'}
                                                    ${lvl._isNew ? 'bg-white/[0.02]' : ''}`}>

                                                {isGooger ? (
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-yellow-500/15 border border-yellow-500/30">
                                                        <IonIcon name="star-outline" className="text-yellow-400 text-xs" />
                                                    </span>
                                                ) : isBuyer ? (
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30">
                                                        <IonIcon name="cart-outline" className="text-blue-400 text-xs" />
                                                    </span>
                                                ) : (
                                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black border ${c.bg} ${c.border} ${c.text}`}>
                                                        {lvl._isNew ? '?' : lvl.level}
                                                    </span>
                                                )}

                                                <input value={lvl.name}
                                                    onChange={e => setField(idx, 'name', e.target.value)}
                                                    className="bg-[#111] border border-[#2a2a2a] text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-white/30 min-w-0" />

                                                <div className="flex items-center gap-1">
                                                    <input type="number" min="0" max="100" step="0.1"
                                                        value={lvl.commission_percentage}
                                                        onChange={e => setField(idx, 'commission_percentage', e.target.value)}
                                                        className="w-16 bg-[#111] border border-[#2a2a2a] text-white text-center rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-white/30" />
                                                    <span className="text-xs text-gray-500">%</span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <input type="number" min="0" max="100" step="0.1"
                                                        value={lvl.ad_commission_percentage}
                                                        onChange={e => setField(idx, 'ad_commission_percentage', e.target.value)}
                                                        className="w-16 bg-[#111] border border-[#2a2a2a] text-white text-center rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-white/30" />
                                                    <span className="text-xs text-gray-500">%</span>
                                                </div>

                                                <Toggle on={lvl.is_active} onChange={v => setField(idx, 'is_active', v)} />

                                                <button onClick={() => handleSaveRow(lvl, idx)} disabled={isSaving}
                                                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors disabled:opacity-40">
                                                    {isSaving ? <Spinner size="sm" /> : <IonIcon name="checkmark-outline" className="text-sm" />}
                                                </button>

                                                {isGooger || isBuyer ? (
                                                    <span className="w-7 h-7 flex items-center justify-center">
                                                        <IonIcon name="lock-closed-outline" className="text-xs text-gray-700" />
                                                    </span>
                                                ) : (
                                                    <button onClick={() => handleDeleteLevel(lvl, idx)} disabled={isDeleting}
                                                        className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-40">
                                                        {isDeleting ? <Spinner size="sm" /> : <IonIcon name="trash-outline" className="text-sm" />}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}

                                    <div className="flex justify-between items-center px-6 py-4 border-t border-[#111]">
                                        <button onClick={() => setEditedLevels(levels.map(l => ({ ...l, ad_commission_percentage: l.ad_commission_percentage ?? 0 })))}
                                            disabled={savingAll}
                                            className="text-xs text-gray-600 hover:text-gray-300 transition-colors disabled:opacity-40">
                                            Reset unsaved changes
                                        </button>
                                        <p className="text-[11px] text-gray-600">
                                            <span className="text-gray-500 font-semibold">Inactive levels</span> receive no commission.
                                        </p>
                                    </div>
                                </>
                            )
                        }
                    </div>
                </div>
            )}

            {/* ════════════════ REFERRAL MAPPING ════════════════ */}
            {tab === 'mapping' && (
                <div className="space-y-3">
                    {/* Googer Root Card */}
                    <div className="bg-[#0a0a0a] border border-yellow-500/30 rounded-2xl overflow-hidden">
                        <div className="flex items-center gap-4 px-6 py-5">
                            <div className="w-12 h-12 rounded-2xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                                <IonIcon name="star-outline" className="text-yellow-400 text-2xl" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-base font-black text-yellow-400">Googer Level</h2>
                                    <span className="text-[10px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">ROOT</span>
                                </div>
                                <p className="text-xs text-gray-500">System root level — all referral chains originate from Googer</p>
                            </div>
                            <div className="hidden sm:flex gap-6 shrink-0">
                                {(() => {
                                    const googerLevel = levels.find(l => l.level === 0);
                                    const googerPct = googerLevel ? Number(googerLevel.commission_percentage) : 0;
                                    const googerEarned = stats?.googer_commission_earned ?? 0;
                                    return (
                                        <>
                                            <div className="text-center">
                                                <p className="text-xl font-black text-yellow-400">{googerPct}%</p>
                                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">Googer Commission</p>
                                            </div>
                                            <div className="w-px bg-[#2a2a2a]" />
                                            <div className="text-center">
                                                <p className="text-xl font-black text-green-400">{fmtG(googerEarned)}</p>
                                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">Googer Earned</p>
                                            </div>
                                            <div className="w-px bg-[#2a2a2a]" />
                                            <div className="text-center">
                                                <p className="text-xl font-black text-white">{fmtN(totalDirectUsers)}</p>
                                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">Direct Users</p>
                                            </div>
                                            <div className="w-px bg-[#2a2a2a]" />
                                            <div className="text-center">
                                                <p className="text-xl font-black text-white">{fmtN(totalNetworkUsers)}</p>
                                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">Network Users</p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                        {/* Mobile stats */}
                        {(() => {
                            const googerLevel = levels.find(l => l.level === 0);
                            const googerPct = googerLevel ? Number(googerLevel.commission_percentage) : 0;
                            const googerEarned = stats?.googer_commission_earned ?? 0;
                            return (
                                <div className="sm:hidden grid grid-cols-4 divide-x divide-[#1a1a1a] border-t border-[#1a1a1a]">
                                    {[
                                        { label: 'Commission', value: `${googerPct}%`, color: 'text-yellow-400' },
                                        { label: 'Earned', value: fmtG(googerEarned), color: 'text-green-400' },
                                        { label: 'Direct', value: fmtN(totalDirectUsers), color: 'text-white' },
                                        { label: 'Network', value: fmtN(totalNetworkUsers), color: 'text-white' },
                                    ].map(s => (
                                        <div key={s.label} className="text-center py-3">
                                            <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                                            <p className="text-[9px] text-gray-600 uppercase tracking-widest">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Level Accordion */}
                    {loadingMapping
                        ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
                        : mapping.length === 0
                            ? (
                                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-14 text-center">
                                    <IonIcon name="git-network-outline" className="text-5xl text-gray-700 mb-3" />
                                    <p className="text-gray-400 font-semibold">No referral data yet</p>
                                    <p className="text-gray-600 text-sm mt-1">Referral relationships appear here once users start referring each other.</p>
                                </div>
                            )
                            : mapping.filter(l => l.level > 0 && l.level !== 99).map(lvl => {
                                const c    = lc(lvl.level);
                                const open = !collapsed.has(lvl.level);
                                return (
                                    <div key={lvl.level} className={`bg-[#0a0a0a] border rounded-2xl overflow-hidden ${c.border}`}>
                                        <button onClick={() => toggleCollapse(lvl.level)}
                                            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors text-left">
                                            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-black border shrink-0 ${c.bg} ${c.border} ${c.text}`}>
                                                {lvl.level}
                                            </span>
                                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                                <span className={`text-sm font-bold ${c.text}`}>Level {lvl.level} — {lvl.level_name}</span>
                                                <span className="text-xs text-gray-600">{lvl.users.length} user{lvl.users.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            <IonIcon name={open ? 'chevron-up-outline' : 'chevron-down-outline'} className="text-gray-600 text-sm shrink-0" />
                                        </button>

                                        {open && (
                                            <div className="border-t border-[#111]">
                                                {lvl.users.length === 0
                                                    ? <p className="px-5 py-4 text-sm text-gray-600 italic">No users at this level yet.</p>
                                                    : (
                                                        <div className="divide-y divide-[#0f0f0f]">
                                                            {lvl.users.map(user => {
                                                                const branchColor = branchColors.get(user.id) ?? BRANCH_PALETTE[0];
                                                                return (
                                                                    <div key={user.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                                                                        <span className="w-2 h-2 rounded-full mt-4 shrink-0" style={{ backgroundColor: branchColor }} />
                                                                        <Avatar user={user} size={9} />
                                                                        <div className="flex-1 min-w-0 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1">
                                                                            {/* Name + username */}
                                                                            <div className="min-w-0">
                                                                                <p className="text-sm font-semibold truncate" style={{ color: branchColor }}>
                                                                                    {user.full_name || user.username}
                                                                                </p>
                                                                                <p className="text-[11px] text-gray-500">@{user.username}</p>
                                                                                <p className="text-[10px] text-gray-600 font-mono">{user.user_code || '—'}</p>
                                                                            </div>
                                                                            {/* Referred by */}
                                                                            <div className="min-w-0">
                                                                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">Referred by</p>
                                                                                <p className="text-[11px] text-gray-300 truncate">
                                                                                    {user.referred_by_full_name || user.referred_by_username
                                                                                        ? `${user.referred_by_full_name || ''} @${user.referred_by_username || ''}`.trim()
                                                                                        : '—'}
                                                                                </p>
                                                                                {user.referral_code_used && (
                                                                                    <p className="text-[10px] text-gray-600 font-mono">{user.referral_code_used}</p>
                                                                                )}
                                                                            </div>
                                                                            {/* Dates */}
                                                                            <div>
                                                                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">Registered</p>
                                                                                <p className="text-[11px] text-gray-400">{fmtDate(user.registered_at)}</p>
                                                                                <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">Referred</p>
                                                                                <p className="text-[11px] text-gray-400">{fmtDate(user.referral_date)}</p>
                                                                            </div>
                                                                            {/* Commission + action */}
                                                                            <div>
                                                                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">Total Commission Earned</p>
                                                                                <p className="text-sm font-bold text-green-400">{fmtG(user.total_commission ?? 0)}</p>
                                                                                <button
                                                                                    onClick={() => openBuyerLine(user.id)}
                                                                                    className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-white/30 px-2.5 py-1.5 rounded-lg transition-colors">
                                                                                    <IonIcon name="git-branch-outline" className="text-xs shrink-0" />
                                                                                    Buyer Line
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )
                                                }
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                    }
                </div>
            )}

            {/* ════════════════ LEADERBOARD ════════════════ */}
            {tab === 'earners' && (
                <div className="space-y-6">
                    {/* Top earners + referrers */}
                    <div className="grid lg:grid-cols-2 gap-5">
                        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1a1a]">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                                    <IonIcon name="cash-outline" className="text-lg text-amber-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white">Top Earners</h2>
                                    <p className="text-xs text-gray-600">Highest referral commission received</p>
                                </div>
                            </div>
                            {loadingEarners
                                ? <div className="flex justify-center py-10"><Spinner /></div>
                                : topEarners.length === 0
                                    ? <p className="py-10 text-center text-gray-600 text-sm">No data yet</p>
                                    : (
                                        <div className="overflow-y-auto max-h-[420px] divide-y divide-[#111]">
                                            {topEarners.map((u, i) => (
                                                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                                                    <span className={`text-xs font-black w-6 text-center shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-gray-700'}`}>#{i + 1}</span>
                                                    <Avatar user={u} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-white truncate">{u.full_name || u.username}</p>
                                                        <p className="text-[10px] text-gray-600">@{u.username} · {fmtN(u.referral_count)} referral{u.referral_count !== 1 ? 's' : ''}</p>
                                                    </div>
                                                    <span className="text-xs font-bold text-amber-400 shrink-0">{fmtG(u.total_earned)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )
                            }
                        </div>

                        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1a1a]">
                                <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                                    <IonIcon name="people-outline" className="text-lg text-purple-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white">Top Referrers</h2>
                                    <p className="text-xs text-gray-600">Users who brought in the most referrals</p>
                                </div>
                            </div>
                            {loadingEarners
                                ? <div className="flex justify-center py-10"><Spinner /></div>
                                : topReferrers.length === 0
                                    ? <p className="py-10 text-center text-gray-600 text-sm">No data yet</p>
                                    : (
                                        <div className="overflow-y-auto max-h-[420px] divide-y divide-[#111]">
                                            {topReferrers.map((u, i) => (
                                                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                                                    <span className={`text-xs font-black w-6 text-center shrink-0 ${i === 0 ? 'text-purple-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-purple-700' : 'text-gray-700'}`}>#{i + 1}</span>
                                                    <Avatar user={u} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-white truncate">{u.full_name || u.username}</p>
                                                        <p className="text-[10px] text-gray-600">@{u.username} · {fmtG(u.total_earned)} earned</p>
                                                    </div>
                                                    <span className="text-xs font-bold text-purple-400 shrink-0">{fmtN(u.referral_count)} users</span>
                                                </div>
                                            ))}
                                        </div>
                                    )
                            }
                        </div>
                    </div>

                    {/* Commission Payout History */}
                    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#1a1a1a]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                                    <IonIcon name="receipt-outline" className="text-lg text-green-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white">Referral Commission Payout History</h2>
                                    <p className="text-xs text-gray-600">{fmtN(payoutsTotal)} total payout records</p>
                                </div>
                            </div>
                            <button onClick={() => loadPayouts(payoutsPage)} disabled={loadingPayouts}
                                className="flex items-center gap-1.5 text-xs border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-white/30 px-3 py-2 rounded-xl transition-colors disabled:opacity-40">
                                <IonIcon name="refresh-outline" className="text-sm" />
                            </button>
                        </div>

                        {loadingPayouts && payouts.length === 0
                            ? <div className="flex justify-center py-10"><Spinner /></div>
                            : payouts.length === 0
                                ? (
                                    <div className="py-14 text-center">
                                        <IonIcon name="receipt-outline" className="text-4xl text-gray-700 mb-3" />
                                        <p className="text-gray-500 text-sm font-semibold">No payout records yet</p>
                                        <p className="text-gray-700 text-xs mt-1">Commission payouts appear here as referral transactions are processed.</p>
                                    </div>
                                )
                                : (
                                    <>
                                        {/* Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-[#1a1a1a]">
                                                        {['Buyer', 'Earner', 'Level', 'Type', 'Pool Amount', 'Commission %', 'Amount Paid', 'Date'].map(h => (
                                                            <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-600 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#0f0f0f]">
                                                    {payouts.map(p => (
                                                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <p className="font-semibold text-white">{p.buyer_full_name || p.buyer_username || '—'}</p>
                                                                {p.buyer_username && <p className="text-[10px] text-gray-600">@{p.buyer_username}</p>}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <p className="font-semibold text-white">{p.earner_full_name || p.earner_username || '—'}</p>
                                                                {p.earner_username && <p className="text-[10px] text-gray-600">@{p.earner_username}</p>}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {p.level != null ? (
                                                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-black border ${lc(p.level).bg} ${lc(p.level).border} ${lc(p.level).text}`}>
                                                                        {p.level}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${p.source_type === 'ad' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                                                                    {p.source_type || 'product'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-300 font-mono">R{Number(p.pool_amount || 0).toFixed(2)}</td>
                                                            <td className="px-4 py-3 text-gray-400">{p.commission_percentage ?? '—'}%</td>
                                                            <td className="px-4 py-3 font-bold text-green-400">R{Number(p.amount_paid || 0).toFixed(2)}</td>
                                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination */}
                                        {payoutsTotal > 20 && (
                                            <div className="flex items-center justify-between px-5 py-4 border-t border-[#111]">
                                                <p className="text-[11px] text-gray-600">
                                                    Showing {((payoutsPage - 1) * 20) + 1}–{Math.min(payoutsPage * 20, payoutsTotal)} of {fmtN(payoutsTotal)}
                                                </p>
                                                <div className="flex gap-1">
                                                    <button onClick={() => loadPayouts(payoutsPage - 1)} disabled={payoutsPage <= 1 || loadingPayouts}
                                                        className="px-3 py-1.5 text-xs border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-white/30 rounded-lg transition-colors disabled:opacity-30">
                                                        Prev
                                                    </button>
                                                    <button onClick={() => loadPayouts(payoutsPage + 1)} disabled={payoutsPage * 20 >= payoutsTotal || loadingPayouts}
                                                        className="px-3 py-1.5 text-xs border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-white/30 rounded-lg transition-colors disabled:opacity-30">
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )
                        }
                    </div>
                </div>
            )}
        </div>
    );
}
