"use client";

import { useEffect, useRef, useState } from "react";
import IonIcon from "@/components/IonIcon";

// Chat limits and custom stickers/emojis apply to every member on every
// package. They live in the main backend (forwarded by the admin backend at
// /api/chat-features), which also stores the uploaded sticker images.
const BASE = "/api/chat-features";
const authHeaders = (): Record<string, string> => {
    try {
        const token = localStorage.getItem("token");
        return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
        return {};
    }
};

type Limits = {
    voice_max_seconds: number;
    media_per_day: number;
    photo_max_mb: number;
    video_max_seconds: number;
    video_max_mb: number;
};

type Sticker = { id: string; url: string; kind: "sticker" | "emoji"; name?: string };

const Shell = ({ icon, title, subtitle, children, wide }: { icon: string; title: string; subtitle: string; children: React.ReactNode; wide?: boolean }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className={`bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-6 w-full ${wide ? "max-w-2xl" : "max-w-md"} shadow-2xl max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                    <IonIcon name={icon} className="text-xl text-white" />
                </div>
                <div>
                    <h3 className="text-white font-bold">{title}</h3>
                    <p className="text-gray-500 text-sm">{subtitle}</p>
                </div>
            </div>
            {children}
        </div>
    </div>
);

export function ChatFeaturesModal({ onClose, onToast }: { onClose: () => void; onToast: (type: "success" | "error", msg: string) => void }) {
    const [limits, setLimits] = useState<Limits | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch(`${BASE}/limits`, { headers: authHeaders(), cache: "no-store" })
            .then(async (r) => {
                const d = await r.json().catch(() => ({}));
                if (!r.ok || !d?.limits) throw new Error(d?.message || `Request failed (${r.status})`);
                setLimits(d.limits);
            })
            .catch((err) => {
                onToast("error", `Could not load chat limits: ${err.message}`);
                onClose();
            });
        // Load once on open — the page re-renders every 30s and must not wipe edits.
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const field = (key: keyof Limits, label: string, hint: string, step = "1") => (
        <label className="block">
            <span className="block text-xs text-gray-400 mb-1.5">{label}</span>
            <input
                type="number"
                min="0"
                step={step}
                value={limits ? String(limits[key]) : ""}
                onChange={(e) => setLimits((cur) => (cur ? { ...cur, [key]: Number(e.target.value) } : cur))}
                className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-white/30"
            />
            <span className="mt-1 block text-[11px] text-gray-600">{hint}</span>
        </label>
    );

    const save = async () => {
        if (!limits) return;
        setSaving(true);
        try {
            const r = await fetch(`${BASE}/limits`, {
                method: "PUT",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify(limits),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.message || "Failed to save");
            onToast("success", "Chat features updated for all packages");
            onClose();
        } catch (err: any) {
            onToast("error", err.message || "Failed to save chat features");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Shell icon="chatbubbles-outline" title="Chat Features" subtitle="Applies to every member on every package, on web and mobile.">
            {!limits ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {field("voice_max_seconds", "Voice note max (seconds)", "Default 120 = 2 min")}
                    {field("media_per_day", "Photos + videos per day", "Per 24 hours. Default 10")}
                    {field("photo_max_mb", "Photo max size (MB)", "Default 3 MB", "0.1")}
                    {field("video_max_seconds", "Video max length (seconds)", "Default 60 = 1 min")}
                    {field("video_max_mb", "Video max size (MB)", "Default 20 MB", "0.5")}
                </div>
            )}
            <div className="flex gap-3 mt-6">
                <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={save} disabled={saving || !limits} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-colors disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
            </div>
        </Shell>
    );
}

export function StickersEmojisModal({ onClose, onToast }: { onClose: () => void; onToast: (type: "success" | "error", msg: string) => void }) {
    const [items, setItems] = useState<Sticker[]>([]);
    const [loading, setLoading] = useState(true);
    const [kind, setKind] = useState<"sticker" | "emoji">("sticker");
    const [name, setName] = useState("");
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await fetch(`${BASE}/custom-stickers`, { headers: authHeaders(), cache: "no-store" });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d?.message || `Request failed (${r.status})`);
            setItems([...(d.stickers || []), ...(d.emojis || [])]);
        } catch (err: any) {
            onToast("error", `Could not load stickers: ${err?.message || ""}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const upload = async (file: File) => {
        setUploading(true);
        try {
            const form = new FormData();
            form.append("image", file);
            form.append("kind", kind);
            form.append("name", name);
            const r = await fetch(`${BASE}/custom-stickers`, { method: "POST", headers: authHeaders(), body: form });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.message || "Upload failed");
            setName("");
            onToast("success", `${kind === "emoji" ? "Emoji" : "Sticker"} added for all members`);
            await load();
        } catch (err: any) {
            onToast("error", err.message || "Upload failed");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const remove = async (id: string) => {
        const r = await fetch(`${BASE}/custom-stickers/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() });
        if (r.ok) { setItems((cur) => cur.filter((i) => i.id !== id)); onToast("success", "Removed"); }
        else onToast("error", "Could not remove");
    };

    const group = (k: "sticker" | "emoji", title: string) => {
        const list = items.filter((i) => (i.kind === "emoji" ? "emoji" : "sticker") === k);
        return (
            <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">{title} ({list.length})</div>
                {list.length === 0 ? (
                    <p className="text-xs text-gray-600 py-3">None yet.</p>
                ) : (
                    <div className="grid grid-cols-6 gap-2">
                        {list.map((i) => (
                            <div key={i.id} className="group relative aspect-square rounded-xl border border-white/10 bg-white/[0.03] p-1.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={i.url} alt={i.name || k} className="h-full w-full object-contain" />
                                <button onClick={() => remove(i.id)} title="Remove" className="absolute -right-1.5 -top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white group-hover:flex">
                                    <IonIcon name="close" className="text-xs" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Shell wide icon="happy-outline" title="Stickers & Emojis" subtitle="Custom stickers and emojis for every member on every package, in chat on web and mobile.">
            <div className="rounded-xl border border-[#242424] bg-[#111] p-4 mb-5 grid grid-cols-[auto_1fr_auto] gap-3 items-end">
                <label className="block">
                    <span className="block text-xs text-gray-400 mb-1.5">Type</span>
                    <select value={kind} onChange={(e) => setKind(e.target.value as "sticker" | "emoji")} className="bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2.5 text-sm">
                        <option value="sticker">Sticker</option>
                        <option value="emoji">Emoji</option>
                    </select>
                </label>
                <label className="block">
                    <span className="block text-xs text-gray-400 mb-1.5">Name (optional)</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2.5 text-sm" />
                </label>
                <button disabled={uploading} onClick={() => fileRef.current?.click()} className="px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 disabled:opacity-50">
                    {uploading ? "Uploading..." : "Upload image"}
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
                <p className="col-span-3 text-[11px] text-gray-600">PNG, JPG, WEBP or GIF, under 1 MB. Transparent PNG/GIF works best.</p>
            </div>
            {loading ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
            ) : (
                <div className="space-y-5">
                    {group("sticker", "Stickers")}
                    {group("emoji", "Emojis")}
                </div>
            )}
            <div className="flex mt-6">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors">Done</button>
            </div>
        </Shell>
    );
}
