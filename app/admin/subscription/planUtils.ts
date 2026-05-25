export type Plan = {
    id: number;
    slug: string;
    name: string;
    price: string;
    duration_days: number;
    badge_color: string;
    accent_color: string;
    googs_limit: number;
    verified_tick: boolean;
    features: string[];
    extra: Record<string, any>;
    is_active: boolean;
    sort_order: number;
    is_free: boolean;
    is_default: boolean;
    created_at: string;
};

export const COLOR_OPTIONS = [
    { value: 'silver', label: 'Silver', hex: '#94a3b8' },
    { value: 'blue',   label: 'Blue',   hex: '#3b82f6' },
    { value: 'gold',   label: 'Gold',   hex: '#facc15' },
    { value: 'amber',  label: 'Amber',  hex: '#f59e0b' },
    { value: 'zinc',   label: 'Zinc',   hex: '#71717a' },
    { value: 'green',  label: 'Green',  hex: '#22c55e' },
    { value: 'red',    label: 'Red',    hex: '#ef4444' },
    { value: 'purple', label: 'Purple', hex: '#a855f7' },
    { value: 'rose',   label: 'Rose',   hex: '#f43f5e' },
    { value: 'indigo', label: 'Indigo', hex: '#6366f1' },
];

/** Resolves a preset name ('silver', 'blue', …) or any hex string to a hex color. */
export function resolveColor(color: string): string {
    const preset = COLOR_OPTIONS.find(c => c.value === color);
    if (preset) return preset.hex;
    if (color && (color.startsWith('#') || color.startsWith('rgb'))) return color;
    return '#94a3b8'; // fallback silver
}
