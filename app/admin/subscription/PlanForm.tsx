"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import { COLOR_OPTIONS, resolveColor, getSavedColors, saveCustomColor, removeCustomColor, isCustomHex, type Plan } from "./planUtils";

type AutoDeleteUnit = 'off' | 'minutes' | 'hours' | 'days' | 'lifetime';
type ContentExpiryUnit = 'minutes' | 'days' | 'months' | 'unlimited';

type FormData = {
    slug: string;
    name: string;
    price: string;
    duration_days: string;
    is_lifetime_plan: boolean;
    badge_color: string;
    badge_tick_color: string;
    accent_color: string;
    verified_tick: boolean;
    is_active: boolean;
    sort_order: string;
};

type Limits = {
    write_goog_limit: string;
    goog_letter_limit: string;
    product_upload_limit: string;
    content_upload_limit: string;
    content_daily_upload_limit: string;
    content_video_limit_minutes: string;
    content_expiry_value: string;
    content_expiry_unit: ContentExpiryUnit;
    ad_videos: string;
    ad_photos: string;
    chat_save: string;
    free_promo_code: boolean;
    promo_code_value: string;
    ads_expiry_value: string;
    ads_expiry_unit: 'minutes' | 'hours' | 'days';
    text_messaging: boolean;
    voice_calls: boolean;
    // Unified chat auto-delete (all plans)
    chat_auto_delete_value: string;
    chat_auto_delete_unit: AutoDeleteUnit;
    // Paid-plan chat features
    chat_text_messaging: string;
    chat_voice_calls: boolean;
    chat_voice_notes_to_text: boolean;
    chat_text_to_voice_note: boolean;
    chat_video_calls: boolean;
};

type LimitKey = 'write_goog_limit' | 'goog_letter_limit' | 'product_upload_limit' | 'ad_videos' | 'ad_photos' | 'chat_save';
type ContentUploadLabelKey = 'content_upload_limit' | 'content_daily_upload_limit' | 'content_video_limit_minutes' | 'content_expiry';

type Labels = Record<LimitKey | 'free_promo_code' | ContentUploadLabelKey, string>;

const DEFAULT_LABELS: Labels = {
    write_goog_limit:     'Write Goog',
    goog_letter_limit:    'Write goog',
    product_upload_limit: '🔻 Product Upload Limit',
    ad_videos:            'Videos (ads)',
    ad_photos:            'Photos (ads)',
    chat_save:            'Chat',
    free_promo_code:      'Free ad promo code (profile)',
    content_upload_limit: 'Upload Content Limit',
    content_daily_upload_limit: 'Daily Uploads',
    content_video_limit_minutes: 'Video Limit',
    content_expiry: 'Upload Content Expiry',
};

// Format templates — label is the editable part (may include emoji), num is the value
const FORMAT: Record<LimitKey, (label: string, num: string) => string> = {
    write_goog_limit:     (l, n) => `${l} – ${n} limit`,
    goog_letter_limit:    (l, n) => `${l} (${n} letters)`,
    product_upload_limit: (l, n) => `${l} – ${n}`,
    ad_videos:            (l, n) => `${n} ${l} save`,
    ad_photos:            (l, n) => `${n} ${l} save`,
    chat_save:            (l, n) => `${n} ${l} save`,
};

const toInt = (v: string) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

function buildFeatures(limits: Limits, labels: Labels, verified_tick: boolean): string[] {
    const f: string[] = [];
    if (verified_tick) f.push('Verification tick');
    (Object.keys(FORMAT) as LimitKey[]).forEach(key => {
        if (toInt(limits[key] as string) > 0)
            f.push(FORMAT[key](labels[key] || DEFAULT_LABELS[key], limits[key] as string));
    });
    if (toInt(limits.content_upload_limit) > 0) {
        f.push(`${labels.content_upload_limit || DEFAULT_LABELS.content_upload_limit} - ${limits.content_upload_limit}`);
    }
    if (toInt(limits.content_daily_upload_limit) > 0) {
        f.push(`${labels.content_daily_upload_limit || DEFAULT_LABELS.content_daily_upload_limit} - ${limits.content_daily_upload_limit}/day`);
    }
    if (toInt(limits.content_video_limit_minutes) > 0) {
        f.push(`${labels.content_video_limit_minutes || DEFAULT_LABELS.content_video_limit_minutes} - ${limits.content_video_limit_minutes} min`);
    }
    if (limits.free_promo_code) f.push(labels.free_promo_code || DEFAULT_LABELS.free_promo_code);
    return f;
}

function planToForm(plan: Plan): FormData {
    const isLifetime = plan.duration_days === 0 || Boolean(plan.extra?.is_lifetime_plan);
    return {
        slug: plan.slug,
        name: plan.name,
        price: plan.price,
        duration_days: isLifetime ? '365' : String(plan.duration_days),
        is_lifetime_plan: isLifetime,
        badge_color: plan.badge_color || 'silver',
        badge_tick_color: String(plan.extra?.badge_tick_color || ''),
        accent_color: plan.accent_color || 'zinc',
        verified_tick: plan.verified_tick,
        is_active: plan.is_active,
        sort_order: String(plan.sort_order),
    };
}

function resolveLegacyAutoDelete(e: Record<string, any>, isDefault: boolean): { value: string; unit: AutoDeleteUnit } {
    // New format takes priority
    if (e.chat_auto_delete_unit) {
        const unit = e.chat_auto_delete_unit as AutoDeleteUnit;
        return { value: unit === 'off' || unit === 'lifetime' ? '1' : String(e.chat_auto_delete_value || '1'), unit };
    }
    // Legacy basic plan: chat_auto_delete_24h boolean
    if (isDefault) {
        return e.chat_auto_delete_24h === false
            ? { value: '24', unit: 'off' }
            : { value: '24', unit: 'hours' };
    }
    // Legacy paid plan: chat_auto_delete_days number
    const days = parseInt(String(e.chat_auto_delete_days || '0'), 10);
    if (days > 0) return { value: String(days), unit: 'days' };
    return { value: '1', unit: 'off' };
}

function planToLimits(plan: Plan): Limits {
    const e = plan.extra || {};
    const autoDelete = resolveLegacyAutoDelete(e, plan.is_default);
    return {
        write_goog_limit:     String(e.write_goog_limit     ?? (plan.is_default ? 5  : 0)),
        goog_letter_limit:    String(e.goog_letter_limit    ?? (plan.is_default ? 75 : 0)),
        product_upload_limit: String(e.product_upload_limit ?? (plan.is_default ? 15 : 0)),
        content_upload_limit: String(e.content_upload_limit ?? (plan.is_default ? 5 : 15)),
        content_daily_upload_limit: String(e.content_daily_upload_limit ?? (plan.is_default ? 1 : 3)),
        content_video_limit_minutes: String(e.content_video_limit_minutes ?? (plan.is_default ? 1 : 5)),
        content_expiry_value: String(e.content_expiry_value ?? '1'),
        content_expiry_unit: (e.content_expiry_unit || 'unlimited') as ContentExpiryUnit,
        ad_videos:            String(e.ad_videos            ?? 0),
        ad_photos:            String(e.ad_photos            ?? 0),
        chat_save:            String(e.chat_save            ?? 0),
        free_promo_code:      Boolean(e.free_promo_code),
        promo_code_value:     String(e.promo_code_value || ''),
        ads_expiry_value:        (() => { const v = parseInt(String(e.ads_expiry_value ?? e.ads_expiry_days ?? e.ad_photo_expiry_days ?? 30), 10); return v <= 10 ? '10' : v <= 20 ? '20' : '30'; })(),
        ads_expiry_unit:         'days' as const,
        text_messaging:          Boolean(e.text_messaging ?? true),
        voice_calls:             plan.is_default ? Boolean(e.voice_calls ?? true) : false,
        chat_auto_delete_value:  autoDelete.value,
        chat_auto_delete_unit:   autoDelete.unit,
        // Paid-plan chat features
        chat_text_messaging:      !plan.is_default ? String(e.text_messaging ?? '') : '',
        chat_voice_calls:         !plan.is_default ? Boolean(e.voice_calls ?? false) : false,
        chat_voice_notes_to_text: Boolean(e.voice_notes_to_text ?? false),
        chat_text_to_voice_note:  Boolean(e.text_to_voice_note ?? false),
        chat_video_calls:         Boolean(e.video_calls ?? false),
    };
}

function planToLabels(plan: Plan): Labels {
    const saved = plan.extra?.labels || {};
    return {
        write_goog_limit:     saved.write_goog_limit     || DEFAULT_LABELS.write_goog_limit,
        goog_letter_limit:    saved.goog_letter_limit    || DEFAULT_LABELS.goog_letter_limit,
        product_upload_limit: saved.product_upload_limit || DEFAULT_LABELS.product_upload_limit,
        ad_videos:            saved.ad_videos            || DEFAULT_LABELS.ad_videos,
        ad_photos:            saved.ad_photos            || DEFAULT_LABELS.ad_photos,
        chat_save:            saved.chat_save            || DEFAULT_LABELS.chat_save,
        free_promo_code:      saved.free_promo_code      || DEFAULT_LABELS.free_promo_code,
        content_upload_limit: saved.content_upload_limit || DEFAULT_LABELS.content_upload_limit,
        content_daily_upload_limit: saved.content_daily_upload_limit || DEFAULT_LABELS.content_daily_upload_limit,
        content_video_limit_minutes: saved.content_video_limit_minutes || DEFAULT_LABELS.content_video_limit_minutes,
        content_expiry: saved.content_expiry || DEFAULT_LABELS.content_expiry,
    };
}

const blankForm = (): FormData => ({
    slug: '', name: '', price: '', duration_days: '30', is_lifetime_plan: false,
    badge_color: 'silver', badge_tick_color: '', accent_color: 'zinc',
    verified_tick: true, is_active: true, sort_order: '0',
});

const blankLimits = (): Limits => ({
    write_goog_limit: '0', goog_letter_limit: '0', product_upload_limit: '0',
    content_upload_limit: '15', content_daily_upload_limit: '3', content_video_limit_minutes: '5',
    content_expiry_value: '1', content_expiry_unit: 'unlimited',
    ad_videos: '0', ad_photos: '0', chat_save: '0', free_promo_code: false, promo_code_value: '',
    ads_expiry_value: '30', ads_expiry_unit: 'days',
    text_messaging: true, voice_calls: true,
    chat_auto_delete_value: '24', chat_auto_delete_unit: 'hours',
    chat_text_messaging: '', chat_voice_calls: false, chat_voice_notes_to_text: false,
    chat_text_to_voice_note: false, chat_video_calls: false,
});

const AUTO_DELETE_UNITS: { value: AutoDeleteUnit; label: string }[] = [
    { value: 'off',      label: 'Off' },
    { value: 'minutes',  label: 'Minutes' },
    { value: 'hours',    label: 'Hours' },
    { value: 'days',     label: 'Days' },
    { value: 'lifetime', label: 'Lifetime' },
];

function resolveTickColor(badgeColor: string, customTickColor?: string) {
    if (customTickColor && customTickColor.match(/^#[0-9a-fA-F]{6}$/)) return customTickColor;
    const resolved = resolveColor(badgeColor);
    if (resolved === '#3d3d3d') return '#ef4444';
    if (resolved === '#ef4444') return '#000000';
    return '#ffffff';
}

function AutoDeleteRow({ limits, setL }: { limits: Limits; setL: <K extends keyof Limits>(key: K, value: Limits[K]) => void }) {
    const unit = limits.chat_auto_delete_unit;
    const showValue = unit !== 'off' && unit !== 'lifetime';
    return (
        <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2">
            <IonIcon name="trash-bin-outline" className="text-base text-gray-400 shrink-0" />
            <span className="flex-1 text-sm text-white">Chat Auto-delete</span>
            {showValue && (
                <input
                    type="number" min="1"
                    value={limits.chat_auto_delete_value}
                    onChange={e => setL('chat_auto_delete_value', e.target.value)}
                    className="w-16 bg-[#0a0a0a] border border-[#2a2a2a] text-white text-center rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-white/30 shrink-0"
                    placeholder="1"
                />
            )}
            <select
                value={unit}
                onChange={e => setL('chat_auto_delete_unit', e.target.value as AutoDeleteUnit)}
                className="bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-white/30 shrink-0 cursor-pointer"
            >
                {AUTO_DELETE_UNITS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            {unit === 'lifetime' && (
                <span className="text-[10px] bg-purple-500/15 border border-purple-500/25 text-purple-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest shrink-0">∞</span>
            )}
            {unit === 'off' && (
                <span className="text-xs text-gray-600 shrink-0">disabled</span>
            )}
        </div>
    );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const isCustom = !COLOR_OPTIONS.find(c => c.value === value);
    const hex = resolveColor(value);
    return (
        <div className="space-y-2.5">
            <label className="block text-xs text-gray-400">{label}</label>
            <div className="flex flex-wrap gap-2 items-center">
                {COLOR_OPTIONS.map(c => (
                    <button key={c.value} type="button" onClick={() => onChange(c.value)} title={c.label}
                        style={{ backgroundColor: c.hex }}
                        className={`w-7 h-7 rounded-full transition-all ${value === c.value ? 'ring-2 ring-offset-2 ring-offset-[#0a0a0a] ring-white scale-110' : 'opacity-55 hover:opacity-100'}`}
                    />
                ))}
                <label className={`relative w-7 h-7 rounded-full cursor-pointer transition-all flex items-center justify-center overflow-hidden border-2 ${isCustom ? 'ring-2 ring-offset-2 ring-offset-[#0a0a0a] ring-white scale-110 border-transparent' : 'border-dashed border-white/25 hover:border-white/50'}`}
                    style={isCustom ? { backgroundColor: hex } : {}}>
                    <input type="color" value={hex} onChange={e => onChange(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                    {!isCustom && <IonIcon name="color-palette-outline" className="text-[11px] text-white/35 pointer-events-none" />}
                </label>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md border border-white/10 shrink-0" style={{ backgroundColor: hex }} />
                <input value={value} onChange={e => onChange(e.target.value)} placeholder="e.g. blue or #3b82f6"
                    className="flex-1 bg-[#111] border border-[#2a2a2a] text-white rounded-lg px-3 py-1.5 text-[11px] font-mono focus:outline-none focus:border-white/30 placeholder-gray-700" />
            </div>
        </div>
    );
}

export default function PlanForm({ initialPlan }: { initialPlan?: Plan }) {
    const router = useRouter();
    const isDefault = !!initialPlan?.is_default;

    const [form, setForm] = useState<FormData>(initialPlan ? planToForm(initialPlan) : blankForm());
    const [limits, setLimits] = useState<Limits>(initialPlan ? planToLimits(initialPlan) : blankLimits());
    const [labels, setLabels] = useState<Labels>(initialPlan ? planToLabels(initialPlan) : { ...DEFAULT_LABELS });
    const setLbl = (key: keyof Labels, val: string) => setLabels(l => ({ ...l, [key]: val }));
    const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
    const toggleFieldEdit = (key: string) => setEditingFields(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [savedColors, setSavedColors] = useState<string[]>(() => getSavedColors());
    const [savedColorPage, setSavedColorPage] = useState(0);
    const [customHexInput, setCustomHexInput] = useState('');
    const SAVED_PAGE_SIZE = 5; // 5 per row, 2 rows shown at a time via pagination

    const set = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm(f => ({ ...f, [key]: value }));
    const setL = <K extends keyof Limits>(key: K, value: Limits[K]) => setLimits(l => ({ ...l, [key]: value }));

    const inputCls = "w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-white/30 placeholder-gray-700";

    const handleSubmit = async () => {
        if (!isDefault && (!form.slug.trim() || !form.name.trim() || form.price === '')) {
            setError('Slug, name and price are required.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            // Build chat feature string for auto-delete (all plans)
            const autoDeleteLabel = (() => {
                if (limits.chat_auto_delete_unit === 'off') return null;
                if (limits.chat_auto_delete_unit === 'lifetime') return 'Chat auto-delete (Lifetime)';
                const v = toInt(limits.chat_auto_delete_value);
                if (v <= 0) return null;
                return `Chat auto-delete (${v} ${limits.chat_auto_delete_unit})`;
            })();

            // Build chat feature strings for paid plans
            const chatFeatures: string[] = [];
            if (!isDefault) {
                if (limits.chat_text_messaging === 'colors') chatFeatures.push('Text messaging (colors)');
                else if (limits.chat_text_messaging === 'colors,stickers') chatFeatures.push('Text messaging (colors, stickers)');
                if (limits.chat_voice_calls) chatFeatures.push('Voice calls');
                if (limits.chat_video_calls) chatFeatures.push('Video calls (240p / 360p limited quality)');
                if (limits.chat_voice_notes_to_text) chatFeatures.push('Voice notes to text conversion');
                if (limits.chat_text_to_voice_note) chatFeatures.push('Text to voice note conversion');
            }
            if (autoDeleteLabel) chatFeatures.push(autoDeleteLabel);

            const extra = {
                ...(initialPlan?.extra || {}),
                badge_tick_color: form.badge_tick_color || '',
                write_goog_limit:     toInt(limits.write_goog_limit),
                goog_letter_limit:    toInt(limits.goog_letter_limit),
                product_upload_limit: toInt(limits.product_upload_limit),
                content_upload_limit: toInt(limits.content_upload_limit),
                content_daily_upload_limit: toInt(limits.content_daily_upload_limit),
                content_video_limit_minutes: toInt(limits.content_video_limit_minutes),
                content_expiry_value: limits.content_expiry_unit === 'unlimited' ? 0 : toInt(limits.content_expiry_value),
                content_expiry_unit: limits.content_expiry_unit,
                ad_videos:            toInt(limits.ad_videos),
                ad_photos:            toInt(limits.ad_photos),
                chat_save:            toInt(limits.chat_save),
                free_promo_code:      limits.free_promo_code,
                promo_code_value:     limits.free_promo_code ? (limits.promo_code_value || '') : '',
                // Unified auto-delete (new format)
                chat_auto_delete_unit:  limits.chat_auto_delete_unit,
                chat_auto_delete_value: limits.chat_auto_delete_unit === 'off' || limits.chat_auto_delete_unit === 'lifetime'
                    ? 0 : toInt(limits.chat_auto_delete_value),
                // Legacy compat fields
                chat_auto_delete_24h:  isDefault && limits.chat_auto_delete_unit !== 'off',
                chat_auto_delete_days: !isDefault && limits.chat_auto_delete_unit === 'days'
                    ? toInt(limits.chat_auto_delete_value) : 0,
                ...(isDefault ? {
                    text_messaging:  limits.text_messaging,
                    voice_calls:     limits.voice_calls,
                } : {
                    text_messaging:       limits.chat_text_messaging,
                    voice_calls:          limits.chat_voice_calls,
                    voice_notes_to_text:  limits.chat_voice_notes_to_text,
                    text_to_voice_note:   limits.chat_text_to_voice_note,
                    video_calls:          limits.chat_video_calls,
                }),
                is_lifetime_plan: form.is_lifetime_plan,
                labels,
            };
            const numericFeatures = buildFeatures(limits, labels, isDefault ? false : form.verified_tick);
            const features = [
                ...numericFeatures,
                ...(chatFeatures.length > 0 ? ['Chat features', ...chatFeatures] : []),
            ];

            const payload: any = isDefault
                ? { googs_limit: toInt(limits.write_goog_limit), extra, features }
                : {
                    slug:         form.slug.trim(),
                    name:         form.name.trim(),
                    price:        parseFloat(form.price) || 0,
                    duration_days: form.is_lifetime_plan ? 0 : toInt(form.duration_days),
                    badge_color:  form.badge_color,
                    accent_color: form.accent_color,
                    googs_limit:  toInt(limits.write_goog_limit),
                    verified_tick:form.verified_tick,
                    features,
                    extra,
                    is_active:    form.is_active,
                    sort_order:   toInt(form.sort_order),
                };

            if (initialPlan) {
                await adminService.updateSubscriptionPlan(initialPlan.id, payload);
            } else {
                await adminService.createSubscriptionPlan(payload);
            }
            setSuccess(true);
            setTimeout(() => router.push('/admin/subscription'), 1200);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/admin/subscription')}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/8 rounded-xl transition-colors">
                    <IonIcon name="arrow-back-outline" className="text-xl" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {initialPlan ? `Edit — ${initialPlan.name}` : 'New Subscription Plan'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {isDefault ? 'Edit free plan limits' : initialPlan ? 'Update plan details' : 'Fill in the details below'}
                    </p>
                </div>
            </div>

            {success && (
                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-300">
                    <IonIcon name="checkmark-circle-outline" className="text-lg shrink-0" />
                    Saved successfully — going back…
                </div>
            )}
            {error && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
                    <IonIcon name="alert-circle-outline" className="text-lg shrink-0" />
                    {error}
                </div>
            )}

            <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl divide-y divide-[#1a1a1a]">

                {/* ── Editing existing paid plan: name + price only ── */}
                {!isDefault && !!initialPlan && (
                    <section className="p-6 space-y-4">
                        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Plan Info</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5">Plan Name</label>
                                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Package 1" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5">Price (Googs)</label>
                                <input type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} placeholder="299" className={inputCls} />
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Creating new plan: full fields ── */}
                {!isDefault && !initialPlan && (
                    <>
                        <section className="p-6 space-y-4">
                            <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Basic Info</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">Plan Name <span className="text-red-400">*</span></label>
                                    <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Package 1" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">Slug <span className="text-red-400">*</span></label>
                                    <input value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                        placeholder="e.g. package-1" className={inputCls + ' font-mono'} />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">Price (Googs) <span className="text-red-400">*</span></label>
                                    <input type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} placeholder="299" className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs text-gray-400 mb-1.5">Duration (days)</label>
                                    <input
                                        type="number" min="1"
                                        value={form.duration_days}
                                        onChange={e => { set('duration_days', e.target.value); if (parseInt(e.target.value) < 365) set('is_lifetime_plan', false); }}
                                        disabled={form.is_lifetime_plan}
                                        className={inputCls + (form.is_lifetime_plan ? ' opacity-40 cursor-not-allowed' : '')}
                                    />
                                    {parseInt(form.duration_days) >= 365 && (
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <div onClick={() => set('is_lifetime_plan', !form.is_lifetime_plan)}
                                                className={`relative w-10 h-5 rounded-full transition-colors ${form.is_lifetime_plan ? 'bg-purple-500' : 'bg-[#2a2a2a]'}`}>
                                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_lifetime_plan ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                            </div>
                                            <span className="text-xs text-gray-300">Lifetime Plan</span>
                                            {form.is_lifetime_plan && <span className="text-[10px] bg-purple-500/15 border border-purple-500/25 text-purple-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Active</span>}
                                        </label>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">Sort Order</label>
                                    <input type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} className={inputCls} />
                                </div>
                            </div>
                        </section>
                        <section className="p-6 space-y-5">
                            <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Appearance</h2>
                            <div className="grid grid-cols-2 gap-8">
                                <ColorPicker label="Badge Color" value={form.badge_color} onChange={v => set('badge_color', v)} />
                                <ColorPicker label="Accent Color" value={form.accent_color} onChange={v => set('accent_color', v)} />
                            </div>
                            <div className="rounded-xl overflow-hidden border border-[#1f1f1f]">
                                <div className="h-1.5" style={{ background: `linear-gradient(to right, ${resolveColor(form.badge_color)}88, ${resolveColor(form.badge_color)})` }} />
                                <div className="px-4 py-3 flex items-center gap-3 bg-[#111]">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wide"
                                        style={{ color: resolveColor(form.badge_color), borderColor: resolveColor(form.badge_color) + '50', backgroundColor: resolveColor(form.badge_color) + '1a' }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: resolveColor(form.badge_color) }} />
                                        {form.badge_color}
                                    </span>
                                    <span className="text-white font-bold text-sm">{form.name || 'Plan Name'}</span>
                                </div>
                            </div>
                        </section>
                        <section className="p-6 space-y-3">
                            <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Settings</h2>
                            <div className="flex gap-6">
                                {([
                                    { key: 'verified_tick' as const, label: 'Verified Tick' },
                                    { key: 'is_active' as const, label: 'Active' },
                                ]).map(({ key, label }) => (
                                    <label key={key} className="flex items-center gap-3 cursor-pointer select-none">
                                        <div onClick={() => set(key, !form[key])}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${form[key] ? 'bg-green-500' : 'bg-[#2a2a2a]'}`}>
                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </div>
                                        <span className="text-sm text-gray-300">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                {/* ── Limits (all plans) ── */}
                <section className="p-6 space-y-5">
                    {isDefault
                        ? <div className="flex items-center gap-2"><span className="text-[10px] bg-green-500/15 border border-green-500/25 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Free Default Plan</span><p className="text-xs text-gray-600">Only limits can be changed.</p></div>
                        : <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Plan Limits</h2>
                    }

                    {/* Verification Tick + Badge Color — inline under Plan Limits heading */}
                    {!isDefault && (
                        <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
                            {/* Tick toggle row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.438 1.69-.882.445-.47.749-1.055.878-1.688.13-.633.08-1.29-.144-1.896.587-.274 1.087-.705 1.443-1.245.356-.54.555-1.17.574-1.817z" fill={resolveColor(form.badge_color)} />
                                        <path d="M7.5 11l2.5 2.5L15 8.5" stroke={resolveTickColor(form.badge_color, form.badge_tick_color)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span className="text-sm font-semibold text-white">Verification Tick</span>
                                    <span className="text-xs text-gray-600">— badge shown on user profile when they own this plan</span>
                                </div>
                                <div
                                    onClick={() => set('verified_tick', !form.verified_tick)}
                                    className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors shrink-0 ${form.verified_tick ? 'bg-green-500' : 'bg-[#2a2a2a]'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.verified_tick ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </div>
                            </div>

                            {/* Badge color picker — shown when tick is on */}
                            {form.verified_tick && (
                                <div className="space-y-2 pt-1 border-t border-[#1f1f1f]">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest pt-1">Badge Color</p>
                                    <div className="grid grid-cols-5 gap-2">
                                        {COLOR_OPTIONS.map(c => {
                                            const sel = form.badge_color === c.value;
                                            return (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    onClick={() => set('badge_color', c.value)}
                                                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${sel ? 'border-white/50 bg-white/10' : 'border-[#2a2a2a] hover:border-white/20'}`}
                                                    title={c.label}
                                                >
                                                    <div className="w-6 h-6 rounded-full" style={{ background: (c.hex === '#ef4444' || c.hex === '#3d3d3d') ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 65%), ${c.hex}` : c.hex }} />
                                                    <span className="text-[9px] text-gray-500 capitalize">{c.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Custom color box + save */}
                                    <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
                                        <span className="text-[10px] text-gray-400 shrink-0">Custom:</span>
                                        <label className="relative cursor-pointer shrink-0">
                                            <input
                                                type="color"
                                                value={customHexInput.length === 7 ? customHexInput : resolveColor(form.badge_color)}
                                                onChange={e => {
                                                    setCustomHexInput(e.target.value);
                                                    set('badge_color', e.target.value);
                                                }}
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                            />
                                            <div
                                                className="w-8 h-8 rounded-lg border-2 border-white/20 shadow-inner cursor-pointer"
                                                style={{ backgroundColor: customHexInput.length === 7 ? customHexInput : resolveColor(form.badge_color) }}
                                            />
                                        </label>
                                        <input
                                            type="text"
                                            value={customHexInput || resolveColor(form.badge_color)}
                                            onChange={e => {
                                                const v = e.target.value;
                                                setCustomHexInput(v);
                                                if (v.match(/^#[0-9a-fA-F]{6}$/)) set('badge_color', v);
                                            }}
                                            className="flex-1 bg-transparent text-white text-xs font-mono focus:outline-none border-b border-[#2a2a2a] focus:border-white/40 pb-0.5 min-w-0"
                                            placeholder="#ffffff"
                                            maxLength={7}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const hex = customHexInput.length === 7 ? customHexInput : resolveColor(form.badge_color);
                                                if (!hex.match(/^#[0-9a-fA-F]{6}$/)) return;
                                                const next = saveCustomColor(hex);
                                                setSavedColors(next);
                                                setSavedColorPage(0);
                                                set('badge_color', hex);
                                                setCustomHexInput('');
                                            }}
                                            className="shrink-0 text-[10px] font-bold text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors"
                                        >
                                            Save
                                        </button>
                                    </div>

                                    {/* Inside tick color */}
                                    <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
                                        <span className="text-[10px] text-gray-400 shrink-0">badge_tick_color:</span>
                                        <label className="relative cursor-pointer shrink-0">
                                            <input
                                                type="color"
                                                value={form.badge_tick_color && form.badge_tick_color.match(/^#[0-9a-fA-F]{6}$/) ? form.badge_tick_color : resolveTickColor(form.badge_color)}
                                                onChange={e => set('badge_tick_color', e.target.value)}
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                            />
                                            <div
                                                className="w-8 h-8 rounded-lg border-2 border-white/20 shadow-inner cursor-pointer"
                                                style={{ backgroundColor: form.badge_tick_color || resolveTickColor(form.badge_color) }}
                                            />
                                        </label>
                                        <input
                                            type="text"
                                            value={form.badge_tick_color || ''}
                                            onChange={e => {
                                                const v = e.target.value;
                                                if (v === '' || v.match(/^#[0-9a-fA-F]{0,6}$/)) set('badge_tick_color', v);
                                            }}
                                            className="flex-1 bg-transparent text-white text-xs font-mono focus:outline-none border-b border-[#2a2a2a] focus:border-white/40 pb-0.5 min-w-0"
                                            placeholder={resolveTickColor(form.badge_color)}
                                            maxLength={7}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => set('badge_tick_color', '')}
                                            className="shrink-0 text-[10px] font-bold text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors"
                                        >
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
                                                    const sel = resolveColor(form.badge_color).toLowerCase() === hex.toLowerCase();
                                                    return (
                                                        <div key={hex + i} className="relative group">
                                                            <button type="button" onClick={() => { set('badge_color', hex); setCustomHexInput(hex); }}
                                                                className={`w-full flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${sel ? 'border-white/50 bg-white/10' : 'border-[#2a2a2a] hover:border-white/20'}`}
                                                                title={hex}>
                                                                <div className="w-6 h-6 rounded-full" style={{ background: (hex === '#ef4444' || hex === '#3d3d3d') ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 65%), ${hex}` : hex }} />
                                                                <span className="text-[8px] text-gray-600 font-mono">{hex}</span>
                                                            </button>
                                                            <button
                                                                type="button"
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
                                    <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2">
                                        <span className="text-[10px] text-gray-500">Preview:</span>
                                        <svg width="16" height="16" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.438 1.69-.882.445-.47.749-1.055.878-1.688.13-.633.08-1.29-.144-1.896.587-.274 1.087-.705 1.443-1.245.356-.54.555-1.17.574-1.817z" fill={resolveColor(form.badge_color)} />
                                            <path d="M7.5 11l2.5 2.5L15 8.5" stroke={resolveTickColor(form.badge_color, form.badge_tick_color)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span className="text-xs font-semibold" style={{ color: resolveColor(form.badge_color) }}>
                                            {COLOR_OPTIONS.find(c => c.value === form.badge_color)?.label || form.badge_color} badge
                                        </span>
                                        <span className="text-[10px] text-gray-600 ml-1">— applied to user automatically when they purchase this plan</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Assigned fields — shown as name : number rows */}
                    {(() => {
                        const numFields: { key: LimitKey; icon: string; basic?: boolean }[] = [
                            { key: 'write_goog_limit',     icon: 'create-outline',    basic: true },
                            { key: 'goog_letter_limit',    icon: 'text-outline',      basic: true },
                            { key: 'product_upload_limit', icon: 'cube-outline',      basic: true },
                            { key: 'ad_videos',            icon: 'videocam-outline' },
                            { key: 'ad_photos',            icon: 'image-outline' },
                            { key: 'chat_save',            icon: 'chatbubble-outline' },
                        ];
                        const visible    = numFields.filter(f => isDefault ? f.basic : true);
                        // For basic plan always show all fields; for paid plans split by value
                        const assigned   = visible.filter(f => isDefault || toInt(limits[f.key]) > 0);
                        const unassigned = visible.filter(f => !isDefault && toInt(limits[f.key]) === 0);

                        return (
                            <div className="space-y-4">
                                {/* Assigned rows */}
                                {assigned.length > 0 && (
                                    <div className="space-y-2">
                                        {assigned.map(f => {
                                            const isEditing = editingFields.has(f.key);
                                            return (
                                                <div key={f.key} className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2">
                                                    <IonIcon name={f.icon} className="text-base text-gray-400 shrink-0" />
                                                    {isEditing ? (
                                                        <input
                                                            autoFocus
                                                            value={labels[f.key]}
                                                            onChange={e => setLbl(f.key, e.target.value)}
                                                            className="flex-1 bg-[#0a0a0a] border border-white/20 text-sm text-white rounded-lg px-2 py-1 focus:outline-none focus:border-white/40 min-w-0"
                                                            placeholder="Field name"
                                                        />
                                                    ) : (
                                                        <span className="flex-1 text-sm text-white truncate">{labels[f.key]}</span>
                                                    )}
                                                    <button type="button" onClick={() => toggleFieldEdit(f.key)}
                                                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isEditing ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}>
                                                        <IonIcon name={isEditing ? 'checkmark-outline' : 'pencil-outline'} className="text-base" />
                                                    </button>
                                                    <input
                                                        type="number" min="0"
                                                        value={limits[f.key]}
                                                        onChange={e => setL(f.key, e.target.value)}
                                                        className="w-20 bg-[#0a0a0a] border border-[#2a2a2a] text-white text-center rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-white/30 shrink-0"
                                                    />
                                                    {!isDefault && (
                                                        <button type="button" onClick={() => { setL(f.key, '0'); setEditingFields(s => { const n = new Set(s); n.delete(f.key); return n; }); }}
                                                            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors shrink-0">
                                                            <IonIcon name="close-outline" className="text-base" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Free promo code (assigned) */}
                                {!isDefault && limits.free_promo_code && (() => {
                                    const isEditing = editingFields.has('free_promo_code');
                                    return (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2">
                                                <IonIcon name="pricetag-outline" className="text-base text-gray-400 shrink-0" />
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        value={labels.free_promo_code}
                                                        onChange={e => setLbl('free_promo_code', e.target.value)}
                                                        className="flex-1 bg-[#0a0a0a] border border-white/20 text-sm text-white rounded-lg px-2 py-1 focus:outline-none focus:border-white/40 min-w-0"
                                                        placeholder="Feature name"
                                                    />
                                                ) : (
                                                    <span className="flex-1 text-sm text-white truncate">{labels.free_promo_code}</span>
                                                )}
                                                <button type="button" onClick={() => toggleFieldEdit('free_promo_code')}
                                                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isEditing ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}>
                                                    <IonIcon name={isEditing ? 'checkmark-outline' : 'pencil-outline'} className="text-base" />
                                                </button>
                                                <button type="button" onClick={() => { setL('free_promo_code', false); setL('promo_code_value' as any, ''); setEditingFields(s => { const n = new Set(s); n.delete('free_promo_code'); return n; }); }}
                                                    className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors shrink-0">
                                                    <IonIcon name="close-outline" className="text-base" />
                                                </button>
                                            </div>
                                            {/* Promo code input */}
                                            <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
                                                <IonIcon name="key-outline" className="text-base text-purple-400 shrink-0" />
                                                <input
                                                    type="text"
                                                    value={limits.promo_code_value}
                                                    onChange={e => setL('promo_code_value' as any, e.target.value.toUpperCase())}
                                                    className="flex-1 bg-transparent text-sm text-white font-mono focus:outline-none placeholder-gray-600 min-w-0"
                                                    placeholder="Enter promo code e.g. PLAN20FREE"
                                                    maxLength={30}
                                                />
                                                {limits.promo_code_value && (
                                                    <span className="text-[10px] text-purple-400 bg-purple-400/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-mono shrink-0">
                                                        {limits.promo_code_value}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-600 px-1">This code will be sent to the user's notification when they purchase this plan.</p>
                                        </div>
                                    );
                                })()}

                                {/* Unassigned section */}
                                {!isDefault && (unassigned.length > 0 || !limits.free_promo_code) && (
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-gray-600 uppercase tracking-widest pt-1">Unassigned — click + to assign</p>
                                        {unassigned.map(f => {
                                            const isEditing = editingFields.has(f.key);
                                            return (
                                                <div key={f.key} className="flex items-center gap-2 bg-[#0d0d0d] border border-dashed border-[#2a2a2a] rounded-xl px-3 py-2">
                                                    <IonIcon name={f.icon} className="text-base text-gray-600 shrink-0" />
                                                    {isEditing ? (
                                                        <input
                                                            autoFocus
                                                            value={labels[f.key]}
                                                            onChange={e => setLbl(f.key, e.target.value)}
                                                            className="flex-1 bg-[#0a0a0a] border border-white/20 text-sm text-white rounded-lg px-2 py-1 focus:outline-none focus:border-white/40 min-w-0"
                                                            placeholder={DEFAULT_LABELS[f.key]}
                                                        />
                                                    ) : (
                                                        <span className="flex-1 text-sm text-gray-500 truncate">{labels[f.key]}</span>
                                                    )}
                                                    <button type="button" onClick={() => toggleFieldEdit(f.key)}
                                                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isEditing ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-600 hover:text-white hover:bg-white/10'}`}>
                                                        <IonIcon name={isEditing ? 'checkmark-outline' : 'pencil-outline'} className="text-base" />
                                                    </button>
                                                    <button type="button" onClick={() => setL(f.key, '1')}
                                                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0">
                                                        <IonIcon name="add-outline" className="text-base" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {!limits.free_promo_code && (() => {
                                            const isEditing = editingFields.has('free_promo_code');
                                            return (
                                            <div className="flex items-center gap-2 bg-[#0d0d0d] border border-dashed border-[#2a2a2a] rounded-xl px-3 py-2">
                                                <IonIcon name="pricetag-outline" className="text-base text-gray-600 shrink-0" />
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        value={labels.free_promo_code}
                                                        onChange={e => setLbl('free_promo_code', e.target.value)}
                                                        className="flex-1 bg-[#0a0a0a] border border-white/20 text-sm text-white rounded-lg px-2 py-1 focus:outline-none focus:border-white/40 min-w-0"
                                                        placeholder={DEFAULT_LABELS.free_promo_code}
                                                    />
                                                ) : (
                                                    <span className="flex-1 text-sm text-gray-500 truncate">{labels.free_promo_code}</span>
                                                )}
                                                <button type="button" onClick={() => toggleFieldEdit('free_promo_code')}
                                                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isEditing ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-600 hover:text-white hover:bg-white/10'}`}>
                                                    <IonIcon name={isEditing ? 'checkmark-outline' : 'pencil-outline'} className="text-base" />
                                                </button>
                                                <button type="button" onClick={() => setL('free_promo_code', true)}
                                                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0">
                                                    <IonIcon name="add-outline" className="text-base" />
                                                </button>
                                            </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Basic plan — feature toggles */}
                    <div className="space-y-3 pt-1 border-t border-[#1a1a1a]">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest">Content Upload</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="space-y-1.5">
                                <span className="flex items-center gap-2 text-xs text-gray-400">
                                    {editingFields.has('content_upload_limit') ? (
                                        <input
                                            autoFocus
                                            value={labels.content_upload_limit}
                                            onChange={e => setLbl('content_upload_limit', e.target.value)}
                                            className="min-w-0 flex-1 bg-[#0a0a0a] border border-white/20 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-white/40"
                                        />
                                    ) : (
                                        <span className="min-w-0 flex-1 truncate">{labels.content_upload_limit}</span>
                                    )}
                                    <button type="button" onClick={() => toggleFieldEdit('content_upload_limit')}
                                        className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white">
                                        <IonIcon name={editingFields.has('content_upload_limit') ? 'checkmark-outline' : 'pencil-outline'} className="text-sm" />
                                    </button>
                                </span>
                                <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
                                    <IonIcon name="albums-outline" className="text-base text-gray-400 shrink-0" />
                                    <input
                                        type="number"
                                        min="0"
                                        value={limits.content_upload_limit}
                                        onChange={e => setL('content_upload_limit', e.target.value)}
                                        className="flex-1 bg-transparent text-sm text-white focus:outline-none min-w-0"
                                        placeholder={isDefault ? '5' : '15'}
                                    />
                                </div>
                                <p className="text-[10px] font-semibold leading-4 text-gray-600">
                                    Total upload-content posts allowed for this plan. Use 0 for unlimited.
                                </p>
                            </label>

                            <label className="space-y-1.5">
                                <span className="flex items-center gap-2 text-xs text-gray-400">
                                    {editingFields.has('content_daily_upload_limit') ? (
                                        <input
                                            autoFocus
                                            value={labels.content_daily_upload_limit}
                                            onChange={e => setLbl('content_daily_upload_limit', e.target.value)}
                                            className="min-w-0 flex-1 bg-[#0a0a0a] border border-white/20 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-white/40"
                                        />
                                    ) : (
                                        <span className="min-w-0 flex-1 truncate">{labels.content_daily_upload_limit}</span>
                                    )}
                                    <button type="button" onClick={() => toggleFieldEdit('content_daily_upload_limit')}
                                        className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white">
                                        <IonIcon name={editingFields.has('content_daily_upload_limit') ? 'checkmark-outline' : 'pencil-outline'} className="text-sm" />
                                    </button>
                                </span>
                                <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
                                    <IonIcon name="layers-outline" className="text-base text-gray-400 shrink-0" />
                                    <input
                                        type="number"
                                        min="0"
                                        value={limits.content_daily_upload_limit}
                                        onChange={e => setL('content_daily_upload_limit', e.target.value)}
                                        className="flex-1 bg-transparent text-sm text-white focus:outline-none min-w-0"
                                        placeholder={isDefault ? '1' : '3'}
                                    />
                                </div>
                                <p className="text-[10px] font-semibold leading-4 text-gray-600">
                                    Per-day publish limit. Example: daily 1 + total 5 means one post per day until 5 total.
                                </p>
                            </label>

                            <label className="space-y-1.5 md:col-span-2">
                                <span className="flex items-center gap-2 text-xs text-gray-400">
                                    {editingFields.has('content_video_limit_minutes') ? (
                                        <input
                                            autoFocus
                                            value={labels.content_video_limit_minutes}
                                            onChange={e => setLbl('content_video_limit_minutes', e.target.value)}
                                            className="min-w-0 flex-1 bg-[#0a0a0a] border border-white/20 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-white/40"
                                        />
                                    ) : (
                                        <span className="min-w-0 flex-1 truncate">{labels.content_video_limit_minutes}</span>
                                    )}
                                    <button type="button" onClick={() => toggleFieldEdit('content_video_limit_minutes')}
                                        className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white">
                                        <IonIcon name={editingFields.has('content_video_limit_minutes') ? 'checkmark-outline' : 'pencil-outline'} className="text-sm" />
                                    </button>
                                </span>
                                <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
                                    <IonIcon name="time-outline" className="text-base text-gray-400 shrink-0" />
                                    <input
                                        type="number"
                                        min="0"
                                        value={limits.content_video_limit_minutes}
                                        onChange={e => setL('content_video_limit_minutes', e.target.value)}
                                        className="flex-1 bg-transparent text-sm text-white focus:outline-none min-w-0"
                                        placeholder={isDefault ? '1' : '5'}
                                    />
                                </div>
                            </label>

                            <label className="space-y-1.5 md:col-span-2">
                                <span className="flex items-center gap-2 text-xs text-gray-400">
                                    {editingFields.has('content_expiry') ? (
                                        <input
                                            autoFocus
                                            value={labels.content_expiry}
                                            onChange={e => setLbl('content_expiry', e.target.value)}
                                            className="min-w-0 flex-1 bg-[#0a0a0a] border border-white/20 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-white/40"
                                        />
                                    ) : (
                                        <span className="min-w-0 flex-1 truncate">{labels.content_expiry}</span>
                                    )}
                                    <button type="button" onClick={() => toggleFieldEdit('content_expiry')}
                                        className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white">
                                        <IonIcon name={editingFields.has('content_expiry') ? 'checkmark-outline' : 'pencil-outline'} className="text-sm" />
                                    </button>
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_150px] gap-2">
                                    <div className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
                                        <IonIcon name="hourglass-outline" className="text-base text-gray-400 shrink-0" />
                                        <input
                                            type="number"
                                            min="1"
                                            disabled={limits.content_expiry_unit === 'unlimited'}
                                            value={limits.content_expiry_value}
                                            onChange={e => setL('content_expiry_value', e.target.value)}
                                            className="flex-1 bg-transparent text-sm text-white focus:outline-none min-w-0 disabled:text-gray-600"
                                            placeholder="1"
                                        />
                                    </div>
                                    <select
                                        value={limits.content_expiry_unit}
                                        onChange={e => setL('content_expiry_unit', e.target.value as ContentExpiryUnit)}
                                        className="bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-white/30"
                                    >
                                        <option value="minutes">Minutes</option>
                                        <option value="days">Days</option>
                                        <option value="months">Months</option>
                                        <option value="unlimited">Lifetime</option>
                                    </select>
                                </div>
                            </label>
                        </div>
                    </div>

                    {isDefault && (
                        <div className="space-y-3 pt-1">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest">Additional Settings</p>

                            {/* Boolean toggles */}
                            {([
                                { key: 'text_messaging' as const, icon: 'chatbox-outline', label: 'Text Messaging' },
                                { key: 'voice_calls'    as const, icon: 'call-outline',     label: 'Voice Calls' },
                            ]).map(f => (
                                <div key={f.key} className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2">
                                    <IonIcon name={f.icon} className="text-base text-gray-400 shrink-0" />
                                    <span className="flex-1 text-sm text-white">{f.label}</span>
                                    <div
                                        onClick={() => setL(f.key, !limits[f.key])}
                                        className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors shrink-0 ${limits[f.key] ? 'bg-green-500' : 'bg-[#2a2a2a]'}`}
                                    >
                                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${limits[f.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </div>
                                </div>
                            ))}

                            {/* Chat Auto-delete (basic plan) */}
                            <AutoDeleteRow limits={limits} setL={setL} />
                        </div>
                    )}

                    {/* Chat Features section — paid plans only */}
                    {!isDefault && (
                        <div className="space-y-3 pt-1 border-t border-[#1a1a1a]">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest">Chat Features</p>

                            {/* Text messaging mode */}
                            <div className="space-y-2">
                                <p className="text-xs text-gray-500">Text Messaging</p>
                                <div className="flex gap-3">
                                    {([
                                        { val: '',               label: 'None' },
                                        { val: 'colors',         label: 'Colors' },
                                        { val: 'colors,stickers',label: 'Colors + Stickers' },
                                    ] as const).map(opt => (
                                        <label key={opt.val} onClick={() => setL('chat_text_messaging', opt.val)}
                                            className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${limits.chat_text_messaging === opt.val ? 'border-white/40 text-white bg-white/8' : 'border-[#2a2a2a] text-gray-500 hover:text-gray-300'}`}>
                                            <div className={`w-3 h-3 rounded-full border-2 transition-colors shrink-0 ${limits.chat_text_messaging === opt.val ? 'border-white bg-white' : 'border-gray-600'}`} />
                                            {opt.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Boolean chat toggles */}
                            {([
                                { key: 'chat_voice_calls'          as const, icon: 'call-outline',         label: 'Voice Calls' },
                                { key: 'chat_video_calls'          as const, icon: 'videocam-outline',     label: 'Video Calls (240p / 360p)' },
                                { key: 'chat_voice_notes_to_text'  as const, icon: 'mic-outline',          label: 'Voice Notes to Text' },
                                { key: 'chat_text_to_voice_note'   as const, icon: 'volume-high-outline',  label: 'Text to Voice Note' },
                            ]).map(f => (
                                <div key={f.key} className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2">
                                    <IonIcon name={f.icon} className="text-base text-gray-400 shrink-0" />
                                    <span className="flex-1 text-sm text-white">{f.label}</span>
                                    <div onClick={() => setL(f.key, !limits[f.key])}
                                        className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors shrink-0 ${limits[f.key] ? 'bg-green-500' : 'bg-[#2a2a2a]'}`}>
                                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${limits[f.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </div>
                                </div>
                            ))}

                            {/* Chat Auto-delete (paid plans) */}
                            <AutoDeleteRow limits={limits} setL={setL} />
                        </div>
                    )}

                    {/* Live preview */}
                    {(() => {
                        const chatPrev: string[] = [];
                        if (!isDefault) {
                            if (limits.chat_text_messaging === 'colors') chatPrev.push('Text messaging (colors)');
                            else if (limits.chat_text_messaging === 'colors,stickers') chatPrev.push('Text messaging (colors, stickers)');
                            if (limits.chat_voice_calls) chatPrev.push('Voice calls');
                            if (limits.chat_video_calls) chatPrev.push('Video calls (240p / 360p limited quality)');
                            if (limits.chat_voice_notes_to_text) chatPrev.push('Voice notes to text conversion');
                            if (limits.chat_text_to_voice_note) chatPrev.push('Text to voice note conversion');
                        }
                        const autoDelPrev = (() => {
                            if (limits.chat_auto_delete_unit === 'off') return null;
                            if (limits.chat_auto_delete_unit === 'lifetime') return 'Chat auto-delete (Lifetime)';
                            const v = toInt(limits.chat_auto_delete_value);
                            return v > 0 ? `Chat auto-delete (${v} ${limits.chat_auto_delete_unit})` : null;
                        })();
                        if (autoDelPrev) chatPrev.push(autoDelPrev);
                        const allFeatures = [
                            ...buildFeatures(limits, labels, isDefault ? false : form.verified_tick),
                            ...(chatPrev.length > 0 ? ['Chat features', ...chatPrev] : []),
                        ];
                        return (
                            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-4">
                                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Features preview</p>
                                {allFeatures.length === 0
                                    ? <p className="text-xs text-gray-600 italic">No features yet.</p>
                                    : <ul className="space-y-1">
                                        {allFeatures.map((f, i) => (
                                            <li key={i} className={`flex items-center gap-2 text-xs ${f === 'Chat features' ? 'text-gray-500 font-semibold pt-1' : 'text-gray-300'}`}>
                                                {f !== 'Chat features' && <IonIcon name="checkmark-outline" className="text-green-400 text-sm shrink-0" />}
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                }
                            </div>
                        );
                    })()}
                </section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pb-8">
                <button onClick={() => router.push('/admin/subscription')}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors">
                    Cancel
                </button>
                <button onClick={handleSubmit} disabled={saving}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center gap-2">
                    {saving && <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                    {saving ? 'Saving…' : initialPlan ? 'Update Plan' : 'Create Plan'}
                </button>
            </div>
        </div>
    );
}
