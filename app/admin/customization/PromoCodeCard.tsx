"use client";

import { useEffect, useState } from "react";
import { adminService } from "@/services/adminService";

type PromoCode = {
    id: number;
    code: string;
    ad_type: string;
    discount_type: string;
    discount_value: number;
    reach_cap: number | null;
    min_reach_bonus: number | null;
    max_reach_bonus: number | null;
    promo_max_days: number | null;
    is_active: boolean;
    max_uses: number | null;
    uses_count: number;
    expires_at: string | null;
    created_at: string;
};

type ReachTier = {
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

type FormState = {
    code: string;
    ad_type: string;
    discount_value: string;
    reach_cap: string;
    max_uses: string;
    expires_at: string;
    is_active: boolean;
};

const EMPTY_FORM: FormState = {
    code: "",
    ad_type: "photo_video_ad",
    discount_value: "",
    reach_cap: "",
    max_uses: "",
    expires_at: "",
    is_active: true,
};

const AD_TYPE_LABELS: Record<string, string> = {
    photo_video_ad: "Photo / Video Ads",
    product_promote_ad: "Product Promote Ads",
    profile_promote_ad: "Profile Promote Ads",
};

const DISCOUNT_UNIT: Record<string, string> = {
    photo_video_ad: "Budget Value (Rs)",
    product_promote_ad: "Budget Value (Rs)",
    profile_promote_ad: "Days",
};

const AD_TYPES = ["photo_video_ad", "product_promote_ad", "profile_promote_ad"] as const;

function isReachType(adType: string) {
    return adType !== "profile_promote_ad";
}

// Calculate min/max reach and max_days from budget and tiers
function calculateReach(budget: number, tiers: ReachTier[]) {
    if (!tiers || tiers.length === 0 || budget <= 0) return { min: 0, max: 0, max_days: null as number | null };
    let applicableTier = tiers[0];
    for (const tier of tiers) {
        if (budget >= Number(tier.budget_from) && (tier.budget_to == null || budget <= Number(tier.budget_to))) {
            applicableTier = tier;
            break;
        }
    }
    const min = Math.round(budget * Number(applicableTier.min_multiplier));
    const max = Math.round(budget * Number(applicableTier.max_multiplier));
    const max_days = applicableTier.max_days != null ? Number(applicableTier.max_days) : null;
    return { min, max, max_days, tier: applicableTier };
}

// Live reach preview — shows the calculated min/max reach and max days
function ReachPreview({ adType, budget, tiers }: { adType: string; budget: number; tiers: ReachTier[] }) {
    if (!isReachType(adType) || budget <= 0 || tiers.length === 0) return null;

    const { min, max, max_days, tier } = calculateReach(budget, tiers);

    return (
        <div className="rounded-2xl border border-blue-400/20 bg-blue-500/[0.06] p-3 space-y-2">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300/70">
                Calculated Reach &amp; Duration
            </p>
            <p className="text-[10px] text-white/50">
                Budget:{" "}
                <span className="text-white/80 font-bold">Rs. {budget.toLocaleString()}</span>
                {" "}→ Tier: Rs. {Number(tier?.budget_from).toLocaleString()} – {tier?.budget_to ? `Rs. ${Number(tier.budget_to).toLocaleString()}` : 'Max'}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-black/30 px-2 py-1.5">
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Multiplier</p>
                    <p className="text-[11px] font-black text-white/60">
                        x{Number(tier?.min_multiplier)} – x{Number(tier?.max_multiplier)}
                    </p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 px-2 py-1.5">
                    <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400/60">Total Reach</p>
                    <p className="text-[11px] font-black text-emerald-300">
                        {min.toLocaleString()} – {max.toLocaleString()}
                    </p>
                </div>
                <div className="rounded-xl bg-violet-500/10 px-2 py-1.5">
                    <p className="text-[8px] font-black uppercase tracking-widest text-violet-400/60">Max Days</p>
                    <p className="text-[11px] font-black text-violet-300">
                        {max_days != null ? `${max_days}d` : '—'}
                    </p>
                </div>
            </div>
            <p className="text-[9px] text-white/30">
                Reach ({min.toLocaleString()} – {max.toLocaleString()}) and max duration ({max_days ?? '—'} days) will be saved to the database.
            </p>
        </div>
    );
}

export default function PromoCodeCard() {
    const [codes, setCodes] = useState<PromoCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [tiers, setTiers] = useState<ReachTier[]>([]);

    const loadCodes = async () => {
        try {
            setLoading(true);
            const data = await adminService.fetchPromoCodes();
            setCodes(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setMessage(err.message || "Failed to load promo codes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadCodes(); }, []);

    // Load reach tiers when ad_type changes (for reach preview)
    useEffect(() => {
        if (!showModal || !isReachType(form.ad_type)) { setTiers([]); return; }
        adminService.fetchReachTiers(form.ad_type).then(setTiers).catch(() => setTiers([]));
    }, [showModal, form.ad_type]);

    const openCreate = (defaultAdType?: string) => {
        setEditId(null);
        setForm({ ...EMPTY_FORM, ad_type: defaultAdType || "photo_video_ad" });
        setMessage(null);
        setShowModal(true);
    };

    const openEdit = (promo: PromoCode) => {
        setEditId(promo.id);
        setForm({
            code: promo.code,
            ad_type: promo.ad_type,
            discount_value: String(promo.discount_value),
            reach_cap: promo.reach_cap !== null ? String(promo.reach_cap) : "",
            max_uses: promo.max_uses !== null ? String(promo.max_uses) : "",
            expires_at: promo.expires_at ? promo.expires_at.slice(0, 10) : "",
            is_active: promo.is_active,
        });
        setMessage(null);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.code.trim()) { setMessage("Promo code is required"); return; }
        const numValue = Number(form.discount_value);
        if (!form.discount_value || !Number.isFinite(numValue) || numValue <= 0) {
            setMessage("Discount value must be a positive number");
            return;
        }

        try {
            setSaving(true);

            const payload: any = {
                code: form.code.trim(),
                ad_type: form.ad_type,
                discount_value: numValue,
                reach_cap: form.reach_cap ? Number(form.reach_cap) : null,
                max_uses: form.max_uses ? Number(form.max_uses) : null,
                expires_at: form.expires_at || null,
                is_active: form.is_active,
            };

            if (editId !== null) {
                await adminService.updatePromoCode(editId, payload);
                setMessage("Promo code updated");
            } else {
                await adminService.createPromoCode(payload);
                setMessage("Promo code created");
            }
            setShowModal(false);
            await loadCodes();
        } catch (err: any) {
            setMessage(err.message || "Failed to save promo code");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            setSaving(true);
            await adminService.deletePromoCode(id);
            setDeleteConfirm(null);
            setMessage("Promo code deleted");
            await loadCodes();
        } catch (err: any) {
            setMessage(err.message || "Failed to delete promo code");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (promo: PromoCode) => {
        try {
            await adminService.updatePromoCode(promo.id, { is_active: !promo.is_active });
            await loadCodes();
        } catch (err: any) {
            setMessage(err.message || "Failed to update promo code");
        }
    };

    const codesForType = (adType: string) => codes.filter((c) => c.ad_type === adType);
    const previewBonus = Number(form.discount_value) || 0;

    return (
        <div className="space-y-6">
            {message && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/75">
                    {message}
                </div>
            )}

            {loading ? (
                <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-8 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                    Loading promo codes...
                </div>
            ) : (
                AD_TYPES.map((adType) => (
                    <div key={adType} className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
                                    {DISCOUNT_UNIT[adType] === "Days" ? "Free days bonus" : "Budget Value (Rs)"}
                                </p>
                                <h3 className="text-sm font-black uppercase text-white">{AD_TYPE_LABELS[adType]}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => openCreate(adType)}
                                className="rounded-2xl bg-white/[0.08] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-white/[0.14]"
                            >
                                + Add Code
                            </button>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Ongoing Promo Codes</p>
                            {codesForType(adType).length === 0 ? (
                                <p className="text-xs text-white/25 py-2">No promo codes yet</p>
                            ) : (
                                codesForType(adType).map((promo) => (
                                    <div
                                        key={promo.id}
                                        className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                                            promo.is_active ? "border-white/10 bg-black/20" : "border-white/5 bg-black/10 opacity-50"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-wrap">
                                            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-white">
                                                {promo.code}
                                            </span>
                                            <span className="text-xs font-bold text-emerald-300">
                                                {DISCOUNT_UNIT[adType] === "Days"
                                                    ? `${promo.discount_value} Free Days`
                                                    : `Rs. ${Number(promo.discount_value).toLocaleString()}`}
                                            </span>
                                            {isReachType(adType) && promo.min_reach_bonus !== null && (
                                                <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-300/80">
                                                    Reach: {Number(promo.min_reach_bonus).toLocaleString()} – {Number(promo.max_reach_bonus).toLocaleString()}
                                                </span>
                                            )}
                                            {isReachType(adType) && promo.promo_max_days !== null && (
                                                <span className="rounded-lg bg-violet-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-violet-300/80">
                                                    Max {promo.promo_max_days}d
                                                </span>
                                            )}
                                            {isReachType(adType) && promo.reach_cap !== null && (
                                                <span className="rounded-lg bg-orange-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-orange-300/80">
                                                    Cap: {Number(promo.reach_cap).toLocaleString()}
                                                </span>
                                            )}
                                            {promo.max_uses !== null && (
                                                <span className="text-[10px] text-white/40">
                                                    {promo.uses_count}/{promo.max_uses} uses
                                                </span>
                                            )}
                                            {promo.expires_at && (
                                                <span className="text-[10px] text-white/40">
                                                    Exp: {new Date(promo.expires_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(promo)}
                                                className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition ${
                                                    promo.is_active
                                                        ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                                        : "bg-white/[0.05] text-white/40 hover:bg-white/10"
                                                }`}
                                            >
                                                {promo.is_active ? "Active" : "Off"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openEdit(promo)}
                                                className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/60 transition hover:bg-white/10"
                                            >
                                                Edit
                                            </button>
                                            {deleteConfirm === promo.id ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(promo.id)}
                                                        disabled={saving}
                                                        className="rounded-lg bg-red-500/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-red-400 transition hover:bg-red-500/30 disabled:opacity-50"
                                                    >
                                                        Confirm
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteConfirm(null)}
                                                        className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/60 transition hover:bg-white/10"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteConfirm(promo.id)}
                                                    className="rounded-lg bg-red-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-red-400/70 transition hover:bg-red-500/20"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 overflow-y-auto py-8">
                    <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#111] p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black uppercase tracking-widest text-white">
                                {editId !== null ? "Edit Promo Code" : "Add Promo Code"}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="text-white/40 hover:text-white transition text-xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        {message && (
                            <p className="text-[10px] font-bold text-red-400">{message}</p>
                        )}

                        <div className="space-y-4">
                            <label className="space-y-1.5">
                                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
                                    Promo Code
                                </span>
                                <input
                                    type="text"
                                    value={form.code}
                                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. ABCD"
                                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold uppercase text-white outline-none placeholder-white/20 tracking-widest"
                                />
                            </label>

                            <label className="space-y-1.5">
                                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
                                    {isReachType(form.ad_type) ? "Budget Value (Rs)" : "Free Days"}
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={form.discount_value}
                                    onChange={(e) => setForm((p) => ({ ...p, discount_value: e.target.value }))}
                                    placeholder={isReachType(form.ad_type) ? "e.g. 1000" : "e.g. 7"}
                                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder-white/20"
                                />
                            </label>

                            {/* Live reach preview — only for reach-type ad types */}
                            <ReachPreview adType={form.ad_type} budget={previewBonus} tiers={tiers} />

                            {/* Reach cap — only for reach-type ad types */}
                            {isReachType(form.ad_type) && (
                                <label className="space-y-1.5">
                                    <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
                                        Maximum Reach Cap (optional)
                                    </span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={form.reach_cap}
                                        onChange={(e) => setForm((p) => ({ ...p, reach_cap: e.target.value }))}
                                        placeholder="e.g. 5000 — ad closes at this reach"
                                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder-white/20"
                                    />
                                    {form.reach_cap && Number(form.reach_cap) > 0 && (
                                        <p className="text-[9px] text-orange-300/70 px-1">
                                            Ad will automatically close when it reaches{" "}
                                            <span className="font-black">{Number(form.reach_cap).toLocaleString()}</span> people
                                        </p>
                                    )}
                                </label>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <label className="space-y-1.5">
                                    <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
                                        Max Uses (optional)
                                    </span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.max_uses}
                                        onChange={(e) => setForm((p) => ({ ...p, max_uses: e.target.value }))}
                                        placeholder="Unlimited"
                                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder-white/20"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
                                        Expires At (optional)
                                    </span>
                                    <input
                                        type="date"
                                        value={form.expires_at}
                                        onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
                                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                                    />
                                </label>
                            </div>

                            {editId !== null && (
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={form.is_active}
                                    onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                                    className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition ${
                                        form.is_active ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/[0.04]"
                                    }`}
                                >
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45">Active</span>
                                    <span className={`relative h-6 w-11 rounded-full border transition ${form.is_active ? "border-emerald-400/60 bg-emerald-400/20" : "border-white/10 bg-black/30"}`}>
                                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${form.is_active ? "left-6" : "left-0.5"}`} />
                                    </span>
                                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${form.is_active ? "text-emerald-300" : "text-white/35"}`}>
                                        {form.is_active ? "On" : "Off"}
                                    </span>
                                </button>
                            )}
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 rounded-2xl bg-white py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white/90 disabled:opacity-60"
                            >
                                {saving ? "Saving..." : editId !== null ? "Save Changes" : "Create Code"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 transition hover:bg-white/[0.08]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
