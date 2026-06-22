"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

type Tab = "googs" | "goog-comments" | "orders" | "product-comments" | "profiles" | "ads";

const TABS: { key: Tab; label: string }[] = [
  { key: "googs", label: "Goog Posts" },
  { key: "goog-comments", label: "Goog Comments" },
  { key: "orders", label: "Order Disputes" },
  { key: "product-comments", label: "Product Comments" },
  { key: "profiles", label: "Profiles" },
  { key: "ads", label: "Ads & Products" },
];

function timeAgo(v: string) {
  if (!v) return "—";
  const s = String(v).trim().replace(" ", "T");
  const withTz = s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s) ? s : s + "Z";
  const d = Date.now() - new Date(withTz).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtId(v: any) {
  if (!v) return "—";
  return String(v).padStart(6, "0");
}

function resolveAvatar(profilePicture: string | null | undefined, name: string) {
  if (!profilePicture) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&size=80&background=random`;
  }
  const p = profilePicture.replace(/\s/g, "").replace(/[\\"]/g, "");
  if (p.startsWith("http") || p.startsWith("data:")) return p;
  return `/uploads/${p.split(/[\\/]/).pop()}`;
}

function UserCard({
  label,
  username,
  fullName,
  publicId,
  dbId,
  profilePicture,
}: {
  label: string;
  username?: string;
  fullName?: string;
  publicId?: any;
  dbId?: any;
  profilePicture?: string | null;
}) {
  const displayName = fullName || username || "Unknown";
  const avatarSrc = resolveAvatar(profilePicture, displayName);
  const userId = publicId || dbId;

  const inner = (
    <div className="flex items-center gap-2.5 group/card">
      <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/10 bg-white/5">
        <Image
          unoptimized
          src={avatarSrc}
          alt={displayName}
          fill
          sizes="36px"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-0.5">{label}</span>
        <span className="text-white/85 text-[11px] font-bold truncate group-hover/card:text-white transition-colors">
          @{username || "—"}
        </span>
        <span className="text-white/30 text-[9px] font-mono">#{fmtId(userId)}</span>
      </div>
    </div>
  );

  if (userId) {
    return (
      <Link
        href={`/admin/users/${userId}?returnTo=/admin/reports&from=Reports`}
        className="block"
      >
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

function ReporterAvatarStack({ reporters }: { reporters: any[] }) {
  if (!reporters || reporters.length === 0) return null;
  const shown = reporters.slice(0, 5);
  const rest = reporters.length - shown.length;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
        Reported by ({reporters.length})
      </span>
      <div className="flex items-center flex-wrap gap-2">
        {shown.map((r: any, i: number) => {
          const avatarSrc = resolveAvatar(r.profile_picture, r.full_name || r.username || "U");
          return (
            <Link
              key={i}
              href={`/admin/users/${r.user_id}?returnTo=/admin/reports&from=Reports`}
              className="flex items-center gap-1.5 group/rep"
              title={`@${r.username}`}
            >
              <div className="relative w-7 h-7 rounded-full overflow-hidden border border-white/10 bg-white/5 shrink-0">
                <Image
                  unoptimized
                  src={avatarSrc}
                  alt={r.username || "User"}
                  fill
                  sizes="28px"
                  className="object-cover"
                />
              </div>
              <span className="text-white/55 text-[10px] font-bold group-hover/rep:text-white transition-colors">
                @{r.username || "—"}
              </span>
            </Link>
          );
        })}
        {rest > 0 && (
          <span className="text-white/30 text-[9px]">+{rest} more</span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400",
    reviewed: "bg-blue-500/10 text-blue-400",
    dismissed: "bg-white/5 text-white/30",
    resolved: "bg-emerald-500/10 text-emerald-400",
    accepted: "bg-emerald-500/10 text-emerald-400",
    rejected: "bg-red-500/10 text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${map[status] || "bg-white/5 text-white/30"}`}>
      {status || "pending"}
    </span>
  );
}

function CommentBox({ label, content }: { label: string; content: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">{label}</p>
      <p className="text-white/75 text-xs leading-relaxed italic">"{content || "—"}"</p>
    </div>
  );
}

function parseReport(raw: any) {
  if (!raw) return null;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("googs");
  const [data, setData] = useState<Record<Tab, any[]>>({ googs: [], "goog-comments": [], orders: [], "product-comments": [], profiles: [], ads: [] });
  const [loading, setLoading] = useState<Record<Tab, boolean>>({ googs: false, "goog-comments": false, orders: false, "product-comments": false, profiles: false, ads: false });
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<Tab, number>>({ googs: 0, "goog-comments": 0, orders: 0, "product-comments": 0, profiles: 0, ads: 0 });

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = { Authorization: `Bearer ${token}` };

  const loadTab = useCallback(async (t: Tab) => {
    setLoading(prev => ({ ...prev, [t]: true }));
    try {
      const r = await fetch(`/api/reports/${t}`, { headers });
      const d = await r.json();
      const rows = d.reports || [];
      setData(prev => ({ ...prev, [t]: rows }));
      setCounts(prev => ({ ...prev, [t]: rows.length }));
    } catch { } finally {
      setLoading(prev => ({ ...prev, [t]: false }));
    }
  }, []);

  useEffect(() => { TABS.forEach(t => loadTab(t.key)); }, [loadTab]);

  const updateGoogStatus = async (id: number, status: string) => {
    await fetch(`/api/reports/googs/${id}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    loadTab("googs");
  };

  const deleteItem = async (endpoint: string, refreshTab: Tab) => {
    if (!confirm("Delete this item permanently?")) return;
    await fetch(endpoint, { method: "DELETE", headers });
    loadTab(refreshTab);
  };

  const rows = data[tab];
  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    if (!q) return true;
    return Object.values(r).some(v => String(v || "").toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">All user-submitted reports across the platform</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search reports..."
          className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none w-56"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(""); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${tab === t.key ? "bg-white text-black" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${tab === t.key ? "bg-black/10 text-black" : "bg-white/10 text-white/60"}`}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] overflow-hidden">
        {loading[tab] ? (
          <div className="p-16 text-center text-slate-500 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center space-y-1">
            <p className="text-slate-500 text-sm">No reports found.</p>
            {(tab === "goog-comments" || tab === "product-comments") && (
              <p className="text-slate-600 text-xs">Reports appear here once users report comments in the app.</p>
            )}
            {tab === "ads" && (
              <p className="text-slate-600 text-xs">Reports appear here once users report a product or ad.</p>
            )}
          </div>
        ) : (

          /* ── GOOG POSTS ── */
          tab === "googs" ? (
            <div className="divide-y divide-white/5">
              {filtered.map((r: any) => (
                <div key={r.id} className="p-5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={r.status || "pending"} />
                      <span className="text-white/25 text-[10px]">{timeAgo(r.created_at)}</span>
                      <span className="text-white/40 text-[10px] font-mono">Goog #{r.goog_id}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => updateGoogStatus(r.id, "reviewed")} className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition">Reviewed</button>
                      <button onClick={() => updateGoogStatus(r.id, "dismissed")} className="px-3 py-1.5 rounded-xl bg-white/5 text-white/35 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition">Dismiss</button>
                    </div>
                  </div>
                  <CommentBox label="Goog content" content={r.goog_content} />
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <UserCard
                      label="Post owner"
                      username={r.goog_owner_username}
                      fullName={r.goog_owner_name}
                      publicId={r.goog_owner_public_id}
                      dbId={r.goog_owner_id}
                      profilePicture={r.goog_owner_profile_picture}
                    />
                    <UserCard
                      label="Reported by"
                      username={r.reporter_username}
                      fullName={r.reporter_name}
                      publicId={r.reporter_user_id}
                      dbId={r.reporter_db_id}
                      profilePicture={r.reporter_profile_picture}
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Reason</span>
                      <span className="text-white/80 text-[11px] font-bold">{r.reason}</span>
                      {r.custom_reason && <span className="text-white/40 text-[10px] italic">{r.custom_reason}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          /* ── GOOG COMMENTS ── */
          ) : tab === "goog-comments" ? (
            <div className="divide-y divide-white/5">
              {filtered.map((r: any) => {
                const reporters: any[] = Array.isArray(r.reporters) ? r.reporters : (typeof r.reporters === "string" ? (() => { try { return JSON.parse(r.reporters); } catch { return []; } })() : []);
                return (
                  <div key={r.id} className="p-5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400">
                          {r.report_count || r.reports || 1} report{(r.report_count || r.reports) !== 1 ? "s" : ""}
                        </span>
                        <span className="text-white/25 text-[10px]">Comment: {timeAgo(r.created_at)}</span>
                        {r.reported_at && <span className="text-rose-400/60 text-[10px]">Reported: {timeAgo(r.reported_at)}</span>}
                      </div>
                      <button onClick={() => deleteItem(`/api/reports/goog-comments/${r.id}`, "goog-comments")} className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition shrink-0">Delete</button>
                    </div>
                    <CommentBox label="Reported comment" content={r.content} />
                    <div className="mt-2 mb-4">
                      <CommentBox label="On goog post" content={r.goog_content} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="flex flex-col gap-3">
                        <UserCard
                          label="Comment by"
                          username={r.commenter_username}
                          fullName={r.commenter_name}
                          publicId={r.commenter_public_id}
                          dbId={r.commenter_db_id}
                          profilePicture={r.commenter_profile_picture}
                        />
                        {r.goog_owner_username && (
                          <UserCard
                            label="Goog post owner"
                            username={r.goog_owner_username}
                            publicId={r.goog_owner_public_id}
                            profilePicture={r.goog_owner_profile_picture}
                          />
                        )}
                      </div>
                      <ReporterAvatarStack reporters={reporters} />
                    </div>
                  </div>
                );
              })}
            </div>

          /* ── ORDERS ── */
          ) : tab === "orders" ? (
            <div className="divide-y divide-white/5">
              {filtered.map((r: any) => {
                const buyerRep = parseReport(r.buyer_report);
                const sellerRep = parseReport(r.seller_report);
                return (
                  <div key={r.order_id} className="p-5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3 flex-wrap mb-4">
                      <span className="text-white font-black text-sm">Order #{r.order_id}</span>
                      <StatusBadge status={r.report_status || "pending"} />
                      {r.report_by && <span className="text-[9px] font-black text-blue-400 uppercase px-2 py-0.5 rounded-full bg-blue-500/10">Reported by {r.report_by}</span>}
                      <span className="text-white/25 text-[10px] ml-auto">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-white/35 text-[10px] mb-4">Product: <span className="text-white/55 font-bold">{r.product_title || "—"}</span></p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <UserCard
                        label="Buyer"
                        username={r.buyer_username}
                        fullName={r.buyer_name}
                        publicId={r.buyer_public_id}
                        dbId={r.buyer_db_id}
                        profilePicture={r.buyer_profile_picture}
                      />
                      <UserCard
                        label="Seller"
                        username={r.seller_username}
                        fullName={r.seller_name}
                        publicId={r.seller_public_id}
                        dbId={r.seller_db_id}
                        profilePicture={r.seller_profile_picture}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {buyerRep && (
                        <div className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-4">
                          <p className="text-[9px] font-black uppercase tracking-widest text-rose-400 mb-2">Buyer Report</p>
                          <p className="text-white/65 text-xs"><span className="text-white/35">Reason:</span> {buyerRep.reason}</p>
                          {buyerRep.custom_text && <p className="text-white/50 text-xs mt-1 italic">{buyerRep.custom_text}</p>}
                        </div>
                      )}
                      {sellerRep && (
                        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
                          <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 mb-2">Seller Report</p>
                          <p className="text-white/65 text-xs"><span className="text-white/35">Reason:</span> {sellerRep.reason}</p>
                          {sellerRep.custom_text && <p className="text-white/50 text-xs mt-1 italic">{sellerRep.custom_text}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          /* ── PRODUCT COMMENTS ── */
          ) : tab === "product-comments" ? (
            <div className="divide-y divide-white/5">
              {filtered.map((r: any) => {
                const reporters: any[] = Array.isArray(r.reporters) ? r.reporters : (typeof r.reporters === "string" ? (() => { try { return JSON.parse(r.reporters); } catch { return []; } })() : []);
                return (
                  <div key={r.id} className="p-5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400">
                          {r.reports} report{r.reports !== 1 ? "s" : ""}
                        </span>
                        <span className="text-white/25 text-[10px]">Comment: {timeAgo(r.created_at)}</span>
                        {r.reported_at && <span className="text-rose-400/60 text-[10px]">Reported: {timeAgo(r.reported_at)}</span>}
                      </div>
                      <button onClick={() => deleteItem(`/api/reports/product-comments/${r.id}`, "product-comments")} className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition shrink-0">Delete</button>
                    </div>
                    <CommentBox label="Reported comment" content={r.content} />
                    <div className="mt-2 mb-4 text-[10px] text-white/35">
                      On product: <span className="text-white/55 font-bold">{r.product_title || "—"}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="flex flex-col gap-3">
                        <UserCard
                          label="Comment by"
                          username={r.commenter_username}
                          fullName={r.commenter_name}
                          publicId={r.commenter_public_id}
                          dbId={r.commenter_db_id}
                          profilePicture={r.commenter_profile_picture}
                        />
                        {r.seller_username && (
                          <UserCard
                            label="Product seller"
                            username={r.seller_username}
                            publicId={r.seller_public_id}
                            dbId={r.seller_db_id}
                            profilePicture={r.seller_profile_picture}
                          />
                        )}
                      </div>
                      <ReporterAvatarStack reporters={reporters} />
                    </div>
                  </div>
                );
              })}
            </div>

          /* ── PROFILES ── */
          ) : tab === "profiles" ? (
            <div className="divide-y divide-white/5">
              {filtered.map((r: any) => (
                <div key={r.id} className="p-5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <StatusBadge status={r.status || "pending"} />
                    <span className="text-white/25 text-[10px]">{timeAgo(r.created_at)}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <UserCard
                      label="Reported user"
                      username={r.reported_username}
                      fullName={r.reported_name}
                      publicId={r.reported_public_id}
                      dbId={r.reported_user_id}
                      profilePicture={r.reported_profile_picture}
                    />
                    <UserCard
                      label="Reported by"
                      username={r.reporter_username}
                      fullName={r.reporter_name}
                      publicId={r.reporter_public_id}
                      dbId={r.reporter_id}
                      profilePicture={r.reporter_profile_picture}
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Reason</span>
                      <span className="text-white/80 text-[11px] font-bold">{r.reason}</span>
                      {r.custom_reason && <span className="text-white/40 text-[10px] italic">{r.custom_reason}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          /* ── ADS & PRODUCTS ── */
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((r: any) => {
                const isAd = r.report_type === "ad";
                const campaignType = r.campaign_type || (isAd ? "Photo & Video" : "Product");
                const typeBadge = isAd
                  ? "bg-purple-500/10 text-purple-400"
                  : "bg-blue-500/10 text-blue-400";
                const typeLabel = isAd ? (campaignType || "Ad") : "Product";
                return (
                  <div key={`${r.report_type}-${r.id}`} className="p-5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <StatusBadge status={r.status || "pending"} />
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${typeBadge}`}>
                        {typeLabel}
                      </span>
                      <span className="text-white/25 text-[10px]">{timeAgo(r.created_at)}</span>
                      <span className="text-white/40 text-[10px] font-mono ml-2">
                        {isAd ? "Ad" : "Product"} #{r.target_id}
                      </span>
                    </div>
                    <p className="text-white/70 text-xs font-bold mb-4">{r.item_title || "—"}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <UserCard
                        label="Reported by"
                        username={r.reporter_username}
                        fullName={r.reporter_name}
                        publicId={r.reporter_public_id}
                        dbId={r.reporter_db_id}
                        profilePicture={r.reporter_profile_picture}
                      />
                      <UserCard
                        label={isAd ? "Advertiser" : "Seller"}
                        username={r.seller_username}
                        fullName={r.seller_name}
                        publicId={r.seller_public_id}
                        dbId={r.seller_db_id}
                        profilePicture={r.seller_profile_picture}
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Reason</span>
                        <span className="text-white/80 text-[11px] font-bold">{r.reason}</span>
                        {r.custom_reason && <span className="text-white/40 text-[10px] italic">{r.custom_reason}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
