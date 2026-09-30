"use client";
import { useEffect, useState, useMemo } from "react";
import IonIcon from "@/components/IonIcon";

const AD_TYPES = [
  { key: "photo_video", label: "Photo & Video Ads", icon: "image", sub: "Control countries for photo/video ad campaigns" },
  { key: "product_promote", label: "Product Promote Ads", icon: "bag-handle", sub: "Control countries for product promotion campaigns" },
  { key: "profile_promote", label: "Profile Promote Ads", icon: "person-circle", sub: "Control countries for profile promotion campaigns" },
] as const;

type AdTypeKey = typeof AD_TYPES[number]["key"];
type Country = { code: string; name: string; flag: string; flagEmoji: string };

const token = () => typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
const hdrs = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

export default function AdAllowedCountriesCard() {
  const [selectedType, setSelectedType] = useState<AdTypeKey | null>(null);
  const [allCountries, setAllCountries] = useState<Country[]>([]);
  const [allowed, setAllowed] = useState<Record<AdTypeKey, string[]>>({
    photo_video: [], product_promote: [], profile_promote: []
  });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadingCountries, setLoadingCountries] = useState(false);

  // Load the shared PostgreSQL-backed country catalog. This keeps admin and
  // mobile aligned and avoids relying on a third-party browser API.
  useEffect(() => {
    setLoadingCountries(true);
    fetch("/api/admin/customization/country-catalog")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Failed to load country catalog")))
      .then((payload: any) => {
        const data = Array.isArray(payload?.countries) ? payload.countries : [];
        const list: Country[] = data
          .filter((c: any) => c?.code && c?.name)
          .map((c: any) => ({
            code: String(c.code).toUpperCase(),
            name: String(c.name),
            flag: String(c.flag || ""),
            flagEmoji: String(c.flag || String.fromCodePoint(...[...String(c.code).toUpperCase()].map((ch: string) => 0x1F1E6 + ch.charCodeAt(0) - 65))),
          }))
          .sort((a: Country, b: Country) => a.name.localeCompare(b.name));
        setAllCountries(list);
      })
      .catch((error: Error) => setSaveError(error?.message || "Failed to load country catalog"))
      .finally(() => setLoadingCountries(false));
  }, []);

  // Load existing settings
  useEffect(() => {
    fetch("/api/admin/customization/ad-allowed-countries/admin", { headers: hdrs() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.allowed_countries) {
          setAllowed({
            photo_video: d.allowed_countries.photo_video || [],
            product_promote: d.allowed_countries.product_promote || [],
            profile_promote: d.allowed_countries.profile_promote || [],
          });
        }
      })
      .catch(() => {});
  }, []);

  const toggle = (code: string) => {
    if (!selectedType) return;
    setAllowed(prev => {
      const cur = prev[selectedType];
      return { ...prev, [selectedType]: cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code] };
    });
  };

  const selectAll = () => {
    if (!selectedType) return;
    setAllowed(prev => ({ ...prev, [selectedType]: allCountries.map(c => c.code) }));
  };

  const clearAll = () => {
    if (!selectedType) return;
    setAllowed(prev => ({ ...prev, [selectedType]: [] }));
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/admin/customization/ad-allowed-countries", {
        method: "PUT", headers: hdrs(),
        body: JSON.stringify({ allowed_countries: allowed }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to save countries");
      }
      if (data?.allowed_countries) {
        setAllowed({
          photo_video: data.allowed_countries.photo_video || [],
          product_promote: data.allowed_countries.product_promote || [],
          profile_promote: data.allowed_countries.profile_promote || [],
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error: any) {
      setSaveError(error?.message || "Failed to save countries");
    } finally { setSaving(false); }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return allCountries;
    const q = search.toLowerCase();
    return allCountries.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [allCountries, search]);

  // ── Step 1: Ad type selector ─────────────────────────────────────────────
  if (!selectedType) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Select Ad Type</p>
          <h3 className="text-sm font-black uppercase text-white mt-0.5">Ad Location Countries</h3>
          <p className="text-[10px] text-white/35 mt-1">Choose an ad type to assign allowed countries for its location dropdown.</p>
        </div>
        <div className="space-y-3">
          {AD_TYPES.map(ad => {
            const count = allowed[ad.key].length;
            return (
              <button
                key={ad.key}
                type="button"
                onClick={() => { setSelectedType(ad.key); setSearch(""); }}
                className="w-full flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left hover:bg-white/[0.07] hover:border-white/20 transition group"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/40 group-hover:text-white transition">
                  <IonIcon name={`${ad.icon}-outline`} className="text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wide text-white">{ad.label}</p>
                  <p className="text-[9px] text-white/35 mt-0.5">{ad.sub}</p>
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full mr-2 ${count === 0 ? "bg-white/5 text-white/30" : "bg-blue-500/15 text-blue-400"}`}>
                  {count === 0 ? "No countries" : `${count} countries`}
                </span>
                <IonIcon name="chevron-forward-outline" className="text-white/25 text-sm shrink-0 group-hover:text-white/60 transition" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 2: Country assignment ───────────────────────────────────────────
  const adInfo = AD_TYPES.find(a => a.key === selectedType)!;
  const currentAllowed = allowed[selectedType];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSelectedType(null)}
          className="flex items-center justify-center w-8 h-8 rounded-xl border border-white/10 bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.07] transition"
        >
          <IonIcon name="arrow-back-outline" className="text-sm" />
        </button>
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Ad Countries</p>
          <h3 className="text-sm font-black uppercase text-white">{adInfo.label}</h3>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${saved ? "bg-emerald-500 text-white" : "bg-white text-black hover:bg-white/90"} disabled:opacity-50`}
        >
          <IonIcon name={saved ? "checkmark-outline" : "save-outline"} className="text-sm" />
          {saved ? "Saved!" : saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Stats + controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
            <IonIcon name="search-outline" className="text-sm" />
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search countries..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-white/25 outline-none focus:border-white/20"
          />
        </div>
        <button onClick={selectAll} className="px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition">Select All</button>
        <button onClick={clearAll} className="px-4 py-2.5 rounded-xl bg-white/[0.03] text-white/40 border border-white/8 text-[10px] font-black uppercase tracking-widest hover:bg-white/[0.07] transition">Clear</button>
        <div className="ml-auto text-[10px] text-white/35 font-bold">
          {currentAllowed.length === 0
            ? <span className="text-amber-400">No countries available</span>
            : <span>{currentAllowed.length} / {allCountries.length} selected</span>}
        </div>
      </div>
      {saveError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-[10px] font-bold text-red-300">
          {saveError}
        </div>
      )}

      {/* Country list */}
      {loadingCountries ? (
        <div className="py-12 text-center text-white/30 text-sm">Loading countries...</div>
      ) : (
        <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="max-h-[480px] overflow-y-auto divide-y divide-white/[0.04]">
            {filtered.map(c => {
              const selected = currentAllowed.includes(c.code);
              return (
                <button
                  key={c.code}
                  onClick={() => toggle(c.code)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04] ${selected ? "bg-blue-500/5" : ""}`}
                >
                  <span className="w-6 shrink-0 text-base leading-none" aria-hidden="true">{c.flagEmoji}</span>
                  <span className={`flex-1 text-xs font-bold ${selected ? "text-white" : "text-white/60"}`}>{c.name}</span>
                  <span className="text-[9px] text-white/25 font-mono">{c.code}</span>
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${selected ? "border-blue-400 bg-blue-400" : "border-white/20"}`}>
                    {selected && <IonIcon name="checkmark" className="text-white text-[8px]" />}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-white/30 text-sm">No countries found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
