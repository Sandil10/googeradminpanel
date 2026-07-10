"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import { resolveColor, type Plan } from "./planUtils";

export default function SubscriptionClient() {
    const router = useRouter();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [expiryModalOpen, setExpiryModalOpen] = useState(false);
    const [expiryValue, setExpiryValue] = useState('30');
    const [expiryUnit, setExpiryUnit] = useState<'minutes' | 'hours' | 'days'>('days');
    const [savingExpiry, setSavingExpiry] = useState(false);
    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const result = await adminService.fetchSubscriptionPlans();
            setPlans(result.data || []);
        } catch (err: any) {
            if (!silent) setError(err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const interval = setInterval(() => load(true), 30_000);
        return () => clearInterval(interval);
    }, []);

    const handleDelete = async (id: number) => {
        setDeleting(true);
        try {
            await adminService.deleteSubscriptionPlan(id);
            showToast('success', 'Plan deleted');
            setDeleteConfirm(null);
            load();
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setDeleting(false);
        }
    };

    const handleToggleActive = async (plan: Plan) => {
        try {
            await adminService.updateSubscriptionPlan(plan.id, { is_active: !plan.is_active });
            showToast('success', `Plan ${!plan.is_active ? 'activated' : 'deactivated'}`);
            load();
        } catch (err: any) {
            showToast('error', err.message);
        }
    };

    const getPlanExpiry = (plan?: Plan) => {
        const extra = plan?.extra || {};
        return {
            value: String(extra.ads_expiry_value ?? extra.ads_expiry_days ?? extra.ad_photo_expiry_days ?? 30),
            unit: (extra.ads_expiry_unit || 'days') as 'minutes' | 'hours' | 'days',
        };
    };
    const getContentExpiryLabel = (plan?: Plan) => {
        const extra = plan?.extra || {};
        const unit = String(extra.content_expiry_unit || 'unlimited');
        if (unit === 'unlimited') return 'Lifetime';
        const value = Math.max(1, Number(extra.content_expiry_value || 1));
        return `${value} ${unit}`;
    };
    const formatVideoLimit = (value: number) => {
        const totalSeconds = Math.max(0, Math.round(value * 60));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes > 0 && seconds > 0) return `${minutes} min ${seconds} sec`;
        if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
        return `${seconds} second${seconds === 1 ? '' : 's'}`;
    };
    const getContentUploadFeatures = (plan?: Plan) => {
        const extra = plan?.extra || {};
        const labels = extra.labels || {};
        const isBasic = !!plan?.is_default || plan?.slug === 'basic' || Number(plan?.price || 0) === 0;
        const uploadContentLimit = Number(extra.content_upload_limit ?? (isBasic ? 5 : 15));
        const dailyUploads = Number(extra.content_daily_upload_limit ?? (isBasic ? 1 : 3));
        const videoLimit = Number(extra.content_video_limit_minutes ?? (isBasic ? 1 : 5));
        const safeVideoLimit = Number.isFinite(videoLimit) ? videoLimit : (isBasic ? 1 : 5);
        return [
            `${labels.content_upload_limit || 'Upload Content Limit'}: ${Number.isFinite(uploadContentLimit) ? uploadContentLimit : (isBasic ? 5 : 15)}`,
            `${labels.content_daily_upload_limit || 'Daily Uploads'}: ${Number.isFinite(dailyUploads) ? dailyUploads : (isBasic ? 1 : 3)}`,
            `${labels.content_video_limit_minutes || 'Video Limit'}: ${formatVideoLimit(safeVideoLimit)}`,
            `${labels.content_expiry || 'Upload Content Expiry'}: ${getContentExpiryLabel(plan)}`,
        ];
    };

    const openExpiryModal = () => {
        const expiry = getPlanExpiry(plans.find(p => p.is_default) || plans[0]);
        setExpiryValue(expiry.value);
        setExpiryUnit(expiry.unit);
        setExpiryModalOpen(true);
    };

    const handleSaveExpiry = async () => {
        const value = Math.max(1, parseInt(expiryValue, 10) || 30);
        setSavingExpiry(true);
        try {
            await Promise.all(plans.map(plan => adminService.updateSubscriptionPlan(plan.id, {
                extra: {
                    ...(plan.extra || {}),
                    ads_expiry_value: value,
                    ads_expiry_unit: expiryUnit,
                },
            })));
            showToast('success', `Ad expiry updated for all plans`);
            setExpiryModalOpen(false);
            load();
        } catch (err: any) {
            showToast('error', err.message || 'Failed to update ad expiry');
        } finally {
            setSavingExpiry(false);
        }
    };

    const freePlan = plans.find(p => p.is_default);
    const paidPlans = plans.filter(p => !p.is_default);
    const sharedExpiry = getPlanExpiry(freePlan || plans[0]);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/admin/subscription/purchases')}
                        className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 transition-colors shrink-0"
                    >
                        <IonIcon name="arrow-back-outline" className="text-lg text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
                            {loading ? 'Loading…' : `${paidPlans.length} paid plan${paidPlans.length !== 1 ? 's' : ''} configured`}
                            {!loading && (
                                <span className="flex items-center gap-1 text-[10px] text-green-500/60 font-medium uppercase tracking-widest">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Live
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openExpiryModal}
                        disabled={loading || plans.length === 0}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors shadow-lg disabled:opacity-50"
                    >
                        <IonIcon name="time-outline" className="text-lg" />
                        Edit Ad Expiry
                    </button>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed left-1/2 top-4 z-[100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${toast.type === 'success' ? 'bg-green-950/90 border-green-500/30 text-green-200' : 'bg-red-950/90 border-red-500/30 text-red-200'}`}>
                    <IonIcon name={toast.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'} className="text-sm shrink-0" />
                    <span className="truncate">{toast.msg}</span>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
                    <IonIcon name="alert-circle-outline" className="text-4xl text-red-400 mb-2" />
                    <p className="text-red-400 font-semibold">{error}</p>
                    <button onClick={() => load()} className="mt-3 text-sm text-red-300 underline hover:text-white">Retry</button>
                </div>
            )}

            {!loading && !error && (
                <div className="space-y-6">
                    {/* Free Default Plan */}
                    {freePlan && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Free Default Plan</span>
                                <div className="flex-1 h-px bg-[#1f1f1f]" />
                                <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-widest">Auto-applied to all users</span>
                            </div>

                            <div className="bg-[#0a0a0a] border border-green-500/20 rounded-2xl overflow-hidden">
                                <div className="h-0.5 w-full bg-gradient-to-r from-green-500/40 to-green-500" />
                                <div className="p-5 flex flex-col md:flex-row gap-5">
                                    {/* Left: plan info */}
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                                                <IonIcon name="shield-checkmark-outline" className="text-lg text-green-400" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-base font-black text-white">{freePlan.name}</h2>
                                                    <span className="text-[10px] bg-green-500/15 border border-green-500/25 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Free</span>
                                                    <span className="text-[10px] bg-[#1a1a1a] text-gray-500 px-2 py-0.5 rounded-full font-medium uppercase tracking-widest">Hidden from users</span>
                                                </div>
                                                <p className="text-xs text-gray-600 mt-0.5">Every new account gets this plan automatically. Cannot be deleted.</p>
                                            </div>
                                        </div>

                                        {/* Limit chips */}
                                        <div className="flex flex-wrap gap-2">
                                            <span className="flex items-center gap-1.5 text-xs text-gray-300 bg-[#161616] border border-[#2a2a2a] px-3 py-1.5 rounded-lg">
                                                <IonIcon name="create-outline" className="text-sm text-gray-500" />
                                                Write Goog: <strong className="text-white ml-0.5">{freePlan.extra?.write_goog_limit ?? freePlan.googs_limit}</strong>
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs text-gray-300 bg-[#161616] border border-[#2a2a2a] px-3 py-1.5 rounded-lg">
                                                <IonIcon name="text-outline" className="text-sm text-gray-500" />
                                                Goog Letters: <strong className="text-white ml-0.5">{freePlan.extra?.goog_letter_limit ?? 75}</strong>
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs text-gray-300 bg-[#161616] border border-[#2a2a2a] px-3 py-1.5 rounded-lg">
                                                <IonIcon name="cube-outline" className="text-sm text-gray-500" />
                                                Product Upload: <strong className="text-white ml-0.5">{freePlan.extra?.product_upload_limit ?? 15}</strong>
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs text-gray-300 bg-[#161616] border border-[#2a2a2a] px-3 py-1.5 rounded-lg">
                                                <IonIcon name="time-outline" className="text-sm text-gray-500" />
                                                Ads Expiry: <strong className="text-white ml-0.5">{sharedExpiry.value} {sharedExpiry.unit}</strong>
                                            </span>
                                            {([
                                                { key: 'text_messaging', icon: 'chatbox-outline', label: 'Text Messaging' },
                                                { key: 'voice_calls',    icon: 'call-outline',    label: 'Voice Calls' },
                                            ] as const).map(f => {
                                                const on = freePlan.extra?.[f.key] !== false;
                                                return (
                                                    <span key={f.key} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${on ? 'text-green-400 bg-green-400/8 border-green-500/20' : 'text-gray-600 bg-[#161616] border-[#2a2a2a]'}`}>
                                                        <IonIcon name={f.icon} className="text-sm shrink-0" />
                                                        {f.label}
                                                        <strong className="ml-0.5">{on ? 'On' : 'Off'}</strong>
                                                    </span>
                                                );
                                            })}
                                            {/* Chat Auto-delete chip */}
                                            {(() => {
                                                const e = freePlan.extra || {};
                                                let label = '';
                                                if (e.chat_auto_delete_unit === 'lifetime') label = 'Lifetime';
                                                else if (e.chat_auto_delete_unit === 'off') label = 'Off';
                                                else if (e.chat_auto_delete_unit && e.chat_auto_delete_value) label = `${e.chat_auto_delete_value} ${e.chat_auto_delete_unit}`;
                                                else label = e.chat_auto_delete_24h === false ? 'Off' : '24 hours';
                                                const isOff = label === 'Off';
                                                return (
                                                    <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${isOff ? 'text-gray-600 bg-[#161616] border-[#2a2a2a]' : 'text-purple-400 bg-purple-400/8 border-purple-500/20'}`}>
                                                        <IonIcon name="trash-bin-outline" className="text-sm shrink-0" />
                                                        Chat Auto-delete
                                                        <strong className="ml-0.5">{label}</strong>
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <div className="space-y-1 pt-1 border-t border-[#1a1a1a]">
                                            <p className="text-[10px] text-gray-500 font-semibold pt-1">Content Upload</p>
                                            {getContentUploadFeatures(freePlan).map((feature) => (
                                                <div key={feature} className="flex items-center gap-1.5 text-xs text-gray-400">
                                                    <IonIcon name="checkmark-outline" className="text-green-400 text-sm shrink-0" />
                                                    {feature}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right: actions */}
                                    <div className="flex md:flex-col gap-2 md:w-36 shrink-0">
                                        <button
                                            onClick={() => router.push(`/admin/subscription/${freePlan.id}/edit`)}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-white/8 hover:bg-white/15 px-3 py-2.5 rounded-xl transition-colors"
                                        >
                                            <IonIcon name="pencil-outline" className="text-sm" />
                                            Edit Limits
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Paid Plans */}
                    <div>
                        {paidPlans.length > 0 && (
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Paid Plans</span>
                                <div className="flex-1 h-px bg-[#1f1f1f]" />
                            </div>
                        )}

                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {paidPlans.map(plan => {
                                const badgeHex = resolveColor(plan.badge_color);

                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative bg-[#0a0a0a] border rounded-2xl overflow-hidden flex flex-col transition-all ${plan.is_active ? 'border-[#1f1f1f]' : 'border-[#161616] opacity-55'}`}
                                    >
                                        <div
                                            className="h-1 w-full"
                                            style={{ background: `linear-gradient(to right, ${badgeHex}70, ${badgeHex})` }}
                                        />

                                        <div className="flex-1 p-5 space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wide"
                                                            style={{
                                                                color: badgeHex,
                                                                borderColor: badgeHex + '55',
                                                                backgroundColor: badgeHex + '18',
                                                            }}
                                                        >
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badgeHex }} />
                                                            {plan.badge_color}
                                                        </span>
                                                        {!plan.is_active && (
                                                            <span className="text-[10px] text-gray-500 bg-[#1a1a1a] px-2 py-0.5 rounded-full font-medium uppercase tracking-widest">Inactive</span>
                                                        )}
                                                    </div>
                                                    <h2 className="text-lg font-black text-white leading-tight">{plan.name}</h2>
                                                    <p className="text-[11px] text-gray-600 font-mono mt-0.5">slug: {plan.slug}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-2xl font-black text-white">
                                                        {parseFloat(plan.price).toLocaleString()}
                                                        <span className="text-sm font-normal text-gray-500 ml-0.5">G</span>
                                                    </div>
                                                    <div className="text-[11px] text-gray-500">
                                                        {plan.extra?.is_lifetime_plan || plan.duration_days === 0 ? 'Lifetime' : `${plan.duration_days} days`}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Chips */}
                                            <div className="flex flex-wrap gap-2">
                                                <span className="flex items-center gap-1 text-xs text-gray-500 bg-[#161616] px-2.5 py-1 rounded-lg">
                                                    <IonIcon name="time-outline" className="text-sm" />
                                                    Ads Expiry: {sharedExpiry.value} {sharedExpiry.unit}
                                                </span>
                                                {plan.verified_tick && (
                                                    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2.5 py-1 rounded-lg">
                                                        <IonIcon name="checkmark-circle" className="text-sm" />
                                                        Verified tick
                                                    </span>
                                                )}
                                                {plan.extra?.is_lifetime_plan ? (
                                                    <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-400/10 px-2.5 py-1 rounded-lg">
                                                        <IonIcon name="infinite-outline" className="text-sm" />
                                                        Lifetime
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-[#161616] px-2.5 py-1 rounded-lg">
                                                        <IonIcon name="calendar-outline" className="text-sm" />
                                                        {plan.duration_days}d
                                                    </span>
                                                )}
                                                {(() => {
                                                    const e = plan.extra || {};
                                                    if (e.chat_auto_delete_unit === 'off' || (!e.chat_auto_delete_unit && !e.chat_auto_delete_days)) return null;
                                                    let label = '';
                                                    if (e.chat_auto_delete_unit === 'lifetime') label = '∞ Lifetime';
                                                    else if (e.chat_auto_delete_unit && e.chat_auto_delete_value) label = `${e.chat_auto_delete_value} ${e.chat_auto_delete_unit}`;
                                                    else if (e.chat_auto_delete_days) label = `${e.chat_auto_delete_days} days`;
                                                    if (!label) return null;
                                                    return (
                                                        <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-400/10 px-2.5 py-1 rounded-lg">
                                                            <IonIcon name="trash-bin-outline" className="text-sm" />
                                                            Del: {label}
                                                        </span>
                                                    );
                                                })()}
                                                <span className="flex items-center gap-1 text-xs text-gray-500 bg-[#161616] px-2.5 py-1 rounded-lg">
                                                    <IonIcon name="swap-vertical-outline" className="text-sm" />
                                                    Order {plan.sort_order}
                                                </span>
                                            </div>

                                            {/* Features list */}
                                            {plan.features && plan.features.length > 0 && (
                                                <div className="space-y-1 pt-1 border-t border-[#1a1a1a]">
                                                    {(plan.features as string[]).map((f, i) => {
                                                        const isHeader = f === 'Chat features';
                                                        return (
                                                            <div key={i} className={`flex items-center gap-1.5 text-xs ${isHeader ? 'text-gray-500 font-semibold pt-1' : 'text-gray-400'}`}>
                                                                {!isHeader && <IonIcon name="checkmark-outline" className="text-green-400 text-sm shrink-0" />}
                                                                {f}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div className="space-y-1 pt-1 border-t border-[#1a1a1a]">
                                                <p className="text-[10px] text-gray-500 font-semibold pt-1">Content Upload</p>
                                                {getContentUploadFeatures(plan).map((feature) => (
                                                    <div key={feature} className="flex items-center gap-1.5 text-xs text-gray-400">
                                                        <IonIcon name="checkmark-outline" className="text-green-400 text-sm shrink-0" />
                                                        {feature}
                                                    </div>
                                                ))}
                                            </div>

                                        </div>

                                        <div className="flex items-center gap-2 px-5 py-4 border-t border-[#1a1a1a]">
                                            <button
                                                onClick={() => router.push(`/admin/subscription/${plan.id}/edit`)}
                                                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-white/8 hover:bg-white/15 px-3 py-2 rounded-xl transition-colors"
                                            >
                                                <IonIcon name="pencil-outline" className="text-sm" />
                                                Edit
                                            </button>
                                            {/* Active toggle */}
                                            <button
                                                onClick={() => handleToggleActive(plan)}
                                                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                                                title={plan.is_active ? 'Deactivate plan' : 'Activate plan'}
                                            >
                                                <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${plan.is_active ? 'bg-green-500' : 'bg-[#2a2a2a]'}`}>
                                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${plan.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </div>
                                                <span className={plan.is_active ? 'text-green-400' : 'text-gray-500'}>
                                                    {plan.is_active ? 'On' : 'Off'}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(plan.id)}
                                                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-400 bg-red-400/10 hover:bg-red-400/20 px-3 py-2 rounded-xl transition-colors"
                                            >
                                                <IonIcon name="trash-outline" className="text-sm" />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {paidPlans.length === 0 && (
                                <div className="col-span-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-12 text-center">
                                    <IonIcon name="card-outline" className="text-5xl text-gray-700 mb-3" />
                                    <p className="text-gray-400 font-semibold">No paid plans yet</p>
                                    <p className="text-gray-600 text-sm mt-1">Paid plans are managed from the existing package setup.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {expiryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                                <IonIcon name="time-outline" className="text-xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold">Edit Ad Expiry</h3>
                                <p className="text-gray-500 text-sm">Applies to Basic, Package 1, Package 2, and Package 3.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block">
                                <span className="block text-xs text-gray-400 mb-1.5">Expiry Value</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={expiryValue}
                                    onChange={(event) => setExpiryValue(event.target.value)}
                                    className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-white/30"
                                />
                            </label>
                            <label className="block">
                                <span className="block text-xs text-gray-400 mb-1.5">Expiry Unit</span>
                                <select
                                    value={expiryUnit}
                                    onChange={(event) => setExpiryUnit(event.target.value as 'minutes' | 'hours' | 'days')}
                                    className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-white/30"
                                >
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                </select>
                            </label>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setExpiryModalOpen(false)}
                                disabled={savingExpiry}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveExpiry}
                                disabled={savingExpiry}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-colors disabled:opacity-50"
                            >
                                {savingExpiry ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-11 h-11 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
                                <IonIcon name="trash-outline" className="text-xl text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold">Delete Plan?</h3>
                                <p className="text-gray-500 text-sm">This cannot be undone.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                disabled={deleting}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
