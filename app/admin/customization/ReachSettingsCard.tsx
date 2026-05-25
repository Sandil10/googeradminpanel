"use client";

import { useEffect, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

// ─── Types ────────────────────────────────────────────────────────────────────
type AdType = "photo_video_ad" | "product_promote_ad" | "profile_promote_ad";

type Tier = {
    id: number;
    ad_type: string;
    budget_from: number;
    budget_to: number;
    min_days: number;
    max_days: number;
    min_multiplier: number;
    max_multiplier: number;
    max_reach_multiplier: number | null;
};

type TierForm = {
    budget_from: string; budget_to: string;
    min_days: string;    max_days: string;
    min_multiplier: string; max_multiplier: string;
};

const DURATION_ONLY: AdType[] = ["profile_promote_ad"];
const isDurationOnly = (ad: AdType | null) => !!ad && DURATION_ONLY.includes(ad);

// ─── Constants ────────────────────────────────────────────────────────────────
const AD_TYPES: { key: AdType; label: string; sub: string; icon: string }[] = [
    { key: "photo_video_ad",    label: "Photo / Video Ads",    sub: "Image & video promotions", icon: "camera" },
    { key: "product_promote_ad",label: "Product Promote Ads",  sub: "Boost product listings",   icon: "bag-handle" },
    { key: "profile_promote_ad",label: "Profile Promote Ads",  sub: "Grow profile visibility",  icon: "person-circle" },
];

const EMPTY_FORM: TierForm = {
    budget_from: "", budget_to: "",
    min_days: "1",  max_days: "1",
    min_multiplier: "", max_multiplier: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function tierToForm(t: Tier): TierForm {
    return {
        budget_from: String(t.budget_from), budget_to: String(t.budget_to),
        min_days: String(t.min_days),       max_days: String(t.max_days),
        min_multiplier: String(t.min_multiplier), max_multiplier: String(t.max_multiplier),
    };
}
function formToPayload(f: TierForm, ad_type: string) {
    return {
        ad_type,
        budget_from: Number(f.budget_from), budget_to: Number(f.budget_to),
        min_days: Number(f.min_days),       max_days: Number(f.max_days),
        min_multiplier: Number(f.min_multiplier), max_multiplier: Number(f.max_multiplier),
    };
}
function findTier(tiers: Tier[], budget: number) {
    return tiers.find(t => budget >= t.budget_from && budget <= t.budget_to) ?? null;
}
function durationLabel(t: Tier) {
    if (t.min_days === t.max_days) return `${t.min_days} day${t.min_days > 1 ? "s" : ""} fixed`;
    return `${t.min_days}–${t.max_days} days`;
}

// ─── Compact labeled input ────────────────────────────────────────────────────
function FI({ label, prefix, value, onChange, placeholder }: {
    label: string; prefix?: string; value: string;
    onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <label className="block space-y-1">
            <span className="block text-[8px] font-black uppercase tracking-[0.18em] text-white/30">{label}</span>
            <div className="flex items-center rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                {prefix && <span className="pl-3 text-[10px] text-white/30 font-black shrink-0">{prefix}</span>}
                <input
                    type="number" min="0" step="any"
                    value={value} placeholder={placeholder}
                    onChange={e => onChange(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent px-3 py-2 text-[11px] text-white outline-none"
                />
            </div>
        </label>
    );
}

// ─── Tier add / edit form ─────────────────────────────────────────────────────
function TierFormPanel({ title, form, setForm, onSave, onCancel, saving, durationOnly }: {
    title: string; form: TierForm;
    setForm: (f: TierForm) => void;
    onSave: () => void; onCancel: () => void; saving: boolean;
    durationOnly: boolean;
}) {
    const set = (k: keyof TierForm) => (v: string) => setForm({ ...form, [k]: v });
    const bf  = Number(form.budget_from) || 0;
    const mnm = Number(form.min_multiplier) || 0;
    const mxm = Number(form.max_multiplier) || 0;
    const mnd = Number(form.min_days) || 1;
    const mxd = Number(form.max_days) || 1;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">{title}</p>
                <button type="button" onClick={onCancel} className="text-white/30 hover:text-white transition">
                    <IonIcon name="close-outline" className="text-base" />
                </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {durationOnly ? (
                    <div className="col-span-2">
                        <FI label="Budget Amount (fixed)" prefix="R" value={form.budget_from} onChange={v => setForm({ ...form, budget_from: v, budget_to: v })} placeholder="e.g. 500" />
                    </div>
                ) : (
                    <>
                        <FI label="Budget From" prefix="R" value={form.budget_from} onChange={set("budget_from")} placeholder="1" />
                        <FI label="Budget To"   prefix="R" value={form.budget_to}   onChange={set("budget_to")}   placeholder="500" />
                    </>
                )}
                <FI label="Min Days" value={form.min_days} onChange={set("min_days")} placeholder="1" />
                <FI label="Max Days" value={form.max_days} onChange={set("max_days")} placeholder="7" />
                {!durationOnly && (
                    <>
                        <FI label="Min Multiplier ×" value={form.min_multiplier} onChange={set("min_multiplier")} placeholder="3" />
                        <FI label="Max Multiplier ×" value={form.max_multiplier} onChange={set("max_multiplier")} placeholder="5" />
                    </>
                )}
            </div>

            {/* Preview */}
            {bf > 0 && (durationOnly || (mnm > 0 && mxm > 0)) && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">Preview at R{bf.toLocaleString()}</p>
                    {!durationOnly && (
                        <p className="text-[12px] font-black text-emerald-300">
                            {Math.round(bf * mnm).toLocaleString()} – {Math.round(bf * mxm).toLocaleString()} reach
                        </p>
                    )}
                    <p className="text-[9px] text-white/35">
                        {mnd === mxd ? `${mnd} day${mnd > 1 ? "s" : ""} (locked)` : `${mnd}–${mxd} days (user selects)`}
                    </p>
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <button
                    type="button" onClick={onCancel}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/[0.08] transition"
                >
                    Cancel
                </button>
                <button
                    type="button" onClick={onSave} disabled={saving}
                    className="flex-1 rounded-2xl bg-white py-2.5 text-[9px] font-black uppercase tracking-widest text-black hover:bg-white/90 transition disabled:opacity-50"
                >
                    {saving ? "Saving..." : "Save Tier"}
                </button>
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ReachSettingsCard() {
    const [selectedAd, setSelectedAd] = useState<AdType | null>(null);
    const [tiers, setTiers]           = useState<Tier[]>([]);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState<string | null>(null);
    const [saving, setSaving]         = useState(false);
    const [deleting, setDeleting]     = useState<number | null>(null);

    const [showAdd, setShowAdd]       = useState(false);
    const [addForm, setAddForm]       = useState<TierForm>(EMPTY_FORM);
    const [editId, setEditId]         = useState<number | null>(null);
    const [editForm, setEditForm]     = useState<TierForm>(EMPTY_FORM);

    // Max reach cap inline editor
    const [capTierId, setCapTierId]   = useState<number | null>(null);
    const [capValue, setCapValue]     = useState("");
    const [savingCap, setSavingCap]   = useState(false);

    const [calcBudget, setCalcBudget] = useState("");

    const load = async (adType: AdType) => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminService.fetchReachTiers(adType);
            setTiers(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const selectAd = (adType: AdType) => {
        setSelectedAd(adType);
        setShowAdd(false);
        setEditId(null);
        setCalcBudget("");
        setError(null);
        load(adType);
    };

    const handleAdd = async () => {
        if (!selectedAd) return;
        setSaving(true); setError(null);
        try {
            await adminService.createReachTier(formToPayload(addForm, selectedAd));
            setShowAdd(false); setAddForm(EMPTY_FORM);
            await load(selectedAd);
        } catch (err: any) { setError(err.message); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: number) => {
        if (!selectedAd) return;
        setDeleting(id); setError(null);
        try {
            await adminService.deleteReachTier(id);
            await load(selectedAd);
        } catch (err: any) { setError(err.message); }
        finally { setDeleting(null); }
    };

    const openCapEditor = (tier: Tier) => {
        setCapTierId(tier.id);
        setCapValue(tier.max_reach_multiplier !== null ? String(tier.max_reach_multiplier) : "");
        setShowAdd(false);
        setEditId(null);
    };

    const handleSaveCap = async () => {
        if (!capTierId || !selectedAd) return;
        setSavingCap(true); setError(null);
        try {
            const cap = capValue === "" ? null : Number(capValue);
            await adminService.setReachTierMaxCap(capTierId, cap);  // sends as max_reach_multiplier
            setCapTierId(null);
            await load(selectedAd);
        } catch (err: any) { setError(err.message); }
        finally { setSavingCap(false); }
    };

    const handleUpdate = async () => {
        if (!editId || !selectedAd) return;
        setSaving(true); setError(null);
        try {
            await adminService.updateReachTier(editId, formToPayload(editForm, selectedAd));
            setEditId(null);
            await load(selectedAd);
        } catch (err: any) { setError(err.message); }
        finally { setSaving(false); }
    };

    const budget = Number(calcBudget);
    const matchedTier = calcBudget && budget > 0 ? findTier(tiers, budget) : null;

    // ── Step 1: Ad type selector ──────────────────────────────────────────────
    if (!selectedAd) {
        return (
            <div className="space-y-4">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Select Ad Type</p>
                    <h3 className="text-sm font-black uppercase text-white mt-0.5">Reach Multiplier Tiers</h3>
                    <p className="text-[10px] text-white/35 mt-1">Choose an ad type to view and edit its budget tiers.</p>
                </div>
                <div className="space-y-3">
                    {AD_TYPES.map(ad => (
                        <button
                            key={ad.key}
                            type="button"
                            onClick={() => selectAd(ad.key)}
                            className="w-full flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left hover:bg-white/[0.07] hover:border-white/20 transition group"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/40 group-hover:text-white transition">
                                <IonIcon name={`${ad.icon}-outline`} className="text-base" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-wide text-white">{ad.label}</p>
                                <p className="text-[9px] text-white/35 mt-0.5">{ad.sub}</p>
                            </div>
                            <IonIcon name="chevron-forward-outline" className="text-white/25 text-sm shrink-0 group-hover:text-white/60 transition" />
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ── Step 2: Tiers for selected ad type ────────────────────────────────────
    const adMeta = AD_TYPES.find(a => a.key === selectedAd)!;

    return (
        <div className="space-y-5">
            {/* Back + heading */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => { setSelectedAd(null); setShowAdd(false); setEditId(null); setError(null); }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white hover:bg-white/[0.08] transition"
                >
                    <IonIcon name="chevron-back-outline" className="text-sm" />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Reach Tiers</p>
                    <h3 className="text-sm font-black uppercase text-white truncate">{adMeta.label}</h3>
                </div>
                {!showAdd && editId === null && (
                    <button
                        type="button"
                        onClick={() => { setShowAdd(true); setAddForm(EMPTY_FORM); }}
                        className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/10 hover:text-white transition shrink-0"
                    >
                        <IonIcon name="add-outline" className="text-sm" />
                        Add Tier
                    </button>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                    <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
                    <p className="text-[10px] font-bold text-rose-300">{error}</p>
                </div>
            )}

            {/* Add form */}
            {showAdd && (
                <TierFormPanel
                    title="New Tier"
                    form={addForm} setForm={setAddForm}
                    onSave={handleAdd} onCancel={() => setShowAdd(false)}
                    saving={saving}
                    durationOnly={isDurationOnly(selectedAd)}
                />
            )}

            {/* Edit form */}
            {editId !== null && (
                <TierFormPanel
                    title={`Edit Tier #${editId}`}
                    form={editForm} setForm={setEditForm}
                    onSave={handleUpdate} onCancel={() => setEditId(null)}
                    saving={saving}
                    durationOnly={isDurationOnly(selectedAd)}
                />
            )}

            {/* Tier table */}
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
                {loading ? (
                    <div className="px-6 py-10 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/25">
                        Loading tiers...
                    </div>
                ) : tiers.length === 0 ? (
                    <div className="px-6 py-10 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">No tiers yet</p>
                        <p className="text-[9px] text-white/20 mt-1">Click "Add Tier" to create the first budget range</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/[0.06]">
                                    {["Budget", "Duration",
                                        ...(!isDurationOnly(selectedAd) ? ["Multiplier", "Estimated Reach", "Max Reach Cap"] : []),
                                        ""].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[8px] font-black uppercase tracking-[0.15em] text-white/25 whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tiers.map(tier => (
                                    <tr key={tier.id} className="border-b border-white/[0.04] last:border-0 group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3 text-[11px] font-bold text-white whitespace-nowrap">
                                            {isDurationOnly(selectedAd)
                                                ? `R${Number(tier.budget_from).toLocaleString()}`
                                                : `R${Number(tier.budget_from).toLocaleString()} – R${Number(tier.budget_to).toLocaleString()}`}
                                        </td>
                                        <td className="px-4 py-3 text-[11px] text-white/50 whitespace-nowrap">
                                            {durationLabel(tier)}
                                        </td>
                                        {!isDurationOnly(selectedAd) && (
                                            <>
                                                <td className="px-4 py-3 text-[11px] font-mono text-white whitespace-nowrap">
                                                    ×{tier.min_multiplier} – ×{tier.max_multiplier}
                                                </td>
                                                <td className="px-4 py-3 text-[11px] font-bold text-emerald-300 whitespace-nowrap">
                                                    {Math.round(Number(tier.budget_to) * tier.min_multiplier).toLocaleString()}
                                                    {" – "}
                                                    {Math.round(Number(tier.budget_to) * tier.max_multiplier).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {tier.max_reach_multiplier !== null ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black text-amber-300">
                                                            <IonIcon name="flag-outline" className="text-[10px]" />
                                                            ×{tier.max_reach_multiplier}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-white/20">Not set</span>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!isDurationOnly(selectedAd) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openCapEditor(tier)}
                                                        className="flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-300 hover:bg-amber-500/20 transition whitespace-nowrap"
                                                    >
                                                        <IonIcon name="flag-outline" className="text-[10px]" />
                                                        {tier.max_reach_multiplier !== null ? "Edit Cap ×" : "Set Max ×"}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditId(tier.id); setEditForm(tierToForm(tier)); setShowAdd(false); setCapTierId(null); }}
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/40 hover:text-white hover:bg-white/10 transition"
                                                >
                                                    <IonIcon name="create-outline" className="text-xs" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(tier.id)}
                                                    disabled={deleting === tier.id}
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-40"
                                                >
                                                    <IonIcon name={deleting === tier.id ? "sync-outline" : "trash-outline"} className={`text-xs ${deleting === tier.id ? "animate-spin" : ""}`} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Max reach multiplier editor — not shown for duration-only ad types */}
            {!isDurationOnly(selectedAd) && capTierId !== null && (() => {
                const tier = tiers.find(t => t.id === capTierId);
                if (!tier) return null;
                const mult = Number(capValue) || 0;
                const budget = Number(tier.budget_from);
                const capAt  = Math.round(budget * mult);
                return (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400/60">
                                    Max Reach Multiplier
                                </p>
                                <p className="text-sm font-black uppercase text-white mt-0.5">
                                    R{Number(tier.budget_from).toLocaleString()} – R{Number(tier.budget_to).toLocaleString()}
                                </p>
                                <p className="text-[9px] text-white/35 mt-1">
                                    Ad auto-closes when reach hits: budget × multiplier. Leave empty to remove.
                                </p>
                            </div>
                            <button type="button" onClick={() => setCapTierId(null)} className="text-white/30 hover:text-white transition shrink-0 ml-4">
                                <IonIcon name="close-outline" className="text-base" />
                            </button>
                        </div>

                        <div className="flex items-center rounded-2xl border border-amber-500/20 bg-black/30 overflow-hidden">
                            <span className="pl-4 text-[11px] font-black text-amber-400/50 shrink-0">×</span>
                            <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={capValue}
                                onChange={e => setCapValue(e.target.value)}
                                placeholder="e.g. 4  →  budget × 4 = max reach"
                                className="flex-1 bg-transparent px-3 py-2.5 text-[11px] text-white outline-none placeholder-white/20"
                            />
                        </div>

                        {mult > 0 && (
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-1">
                                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">Preview</p>
                                <p className="text-[11px] text-white/70">
                                    R{budget.toLocaleString()} × {mult} = closes at <span className="font-black text-amber-300">{capAt.toLocaleString()}</span> reach
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setCapTierId(null)}
                                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/[0.08] transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCap}
                                disabled={savingCap}
                                className="flex-1 rounded-2xl bg-amber-400 py-2.5 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-300 transition disabled:opacity-50"
                            >
                                {savingCap ? "Saving..." : capValue === "" ? "Remove Multiplier" : "Save Max Reach ×"}
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Live budget calculator */}
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Live Reach Calculator</p>
                <div className="flex items-center rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
                    <span className="pl-4 text-[11px] font-black text-white/30 shrink-0">R</span>
                    <input
                        type="number" min="0" step="any"
                        value={calcBudget}
                        onChange={e => setCalcBudget(e.target.value)}
                        placeholder="Enter budget to preview reach..."
                        className="flex-1 bg-transparent px-3 py-3 text-[11px] text-white outline-none"
                    />
                </div>

                {calcBudget && budget > 0 && (
                    matchedTier ? (
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">
                                    Tier: R{Number(matchedTier.budget_from).toLocaleString()} – R{Number(matchedTier.budget_to).toLocaleString()}
                                </p>
                            </div>
                            <div className={`grid gap-4 ${isDurationOnly(selectedAd) ? "grid-cols-1" : "grid-cols-2"}`}>
                                {!isDurationOnly(selectedAd) && (
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/25 mb-1">Estimated Reach</p>
                                        <p className="text-base font-black text-emerald-300">
                                            {Math.round(budget * matchedTier.min_multiplier).toLocaleString()}
                                            {" – "}
                                            {Math.round(budget * matchedTier.max_multiplier).toLocaleString()}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/25 mb-1">Duration</p>
                                    <p className="text-sm font-black text-white">
                                        {matchedTier.min_days === matchedTier.max_days
                                            ? `${matchedTier.min_days} day${matchedTier.min_days > 1 ? "s" : ""}`
                                            : `${matchedTier.min_days}–${matchedTier.max_days} days`}
                                    </p>
                                    <p className="text-[9px] text-white/30 mt-0.5">
                                        {matchedTier.min_days === matchedTier.max_days ? "Fixed — no selection" : "User selects in range"}
                                    </p>
                                </div>
                            </div>
                            {!isDurationOnly(selectedAd) && (
                                <div className="pt-2 border-t border-white/[0.05]">
                                    <p className="text-[8px] text-white/20 font-black uppercase tracking-widest mb-0.5">Formula</p>
                                    <p className="text-[9px] text-white/40 font-mono">
                                        R{budget} × {matchedTier.min_multiplier} = {Math.round(budget * matchedTier.min_multiplier).toLocaleString()} &nbsp;/&nbsp; R{budget} × {matchedTier.max_multiplier} = {Math.round(budget * matchedTier.max_multiplier).toLocaleString()}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                            <IonIcon name="warning-outline" className="text-sm text-amber-400 shrink-0" />
                            <p className="text-[10px] font-bold text-amber-300">
                                No tier covers R{budget.toLocaleString()}. Add or adjust a tier to include this budget.
                            </p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
