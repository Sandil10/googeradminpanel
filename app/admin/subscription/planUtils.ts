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
    { value: 'blue',   label: 'Blue',   hex: '#3897F0' },
    { value: 'gold',   label: 'Gold',   hex: '#facc15' },
    { value: 'green',  label: 'Green',  hex: '#22c55e' },
    { value: 'purple', label: 'Purple', hex: '#a855f7' },
    { value: 'red',    label: 'Red',    hex: '#ef4444' },
    { value: 'orange', label: 'Orange', hex: '#f97316' },
    { value: 'cyan',   label: 'Cyan',   hex: '#06b6d4' },
    { value: 'silver', label: 'Silver', hex: '#94a3b8' },
    { value: 'bronze', label: 'Bronze', hex: '#cd7f32' },
    { value: 'black',  label: 'Black',  hex: '#3d3d3d' },
];

/** Resolves a preset name ('silver', 'blue', …) or any hex string to a hex color. */
export function resolveColor(color: string): string {
    const preset = COLOR_OPTIONS.find(c => c.value === color);
    if (preset) return preset.hex;
    if (color && (color.startsWith('#') || color.startsWith('rgb'))) return color;
    return '#94a3b8'; // fallback silver
}

/** True if the given hex is a custom (non-preset) full 7-char hex */
export function isCustomHex(color: string): boolean {
    if (!color || !color.startsWith('#') || color.length !== 7) return false;
    return !COLOR_OPTIONS.some(c => c.hex.toLowerCase() === color.toLowerCase());
}

const SAVED_COLORS_KEY = 'googer-badge-saved-colors';
const MAX_SAVED = 10;

export function getSavedColors(): string[] {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(SAVED_COLORS_KEY) || '[]'); } catch { return []; }
}

export function saveCustomColor(hex: string): string[] {
    const existing = getSavedColors().filter(c => c.toLowerCase() !== hex.toLowerCase());
    const next = [hex, ...existing].slice(0, MAX_SAVED);
    try { localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(next)); } catch {}
    return next;
}

export function removeCustomColor(hex: string): string[] {
    const next = getSavedColors().filter(c => c.toLowerCase() !== hex.toLowerCase());
    try { localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(next)); } catch {}
    return next;
}
