"use client";
import { useEffect, useState } from "react";

function timeAgo(v: string) {
  const d = Date.now() - new Date(v).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function OrderReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/reports/orders", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const d = await r.json();
      setReports(d.reports || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = reports.filter(r =>
    [r.buyer_username, r.seller_username, r.product_title, r.report_status].some(f => String(f || "").toLowerCase().includes(search.toLowerCase()))
  );

  const parseReport = (raw: any) => {
    if (!raw) return null;
    try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Order Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">{reports.length} orders with reports</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none w-56" />
      </div>

      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] overflow-hidden">
        {loading ? (
          <div className="p-20 text-center text-slate-500 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-20 text-center text-slate-500 text-sm">No order reports found.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(r => {
              const buyerRep = parseReport(r.buyer_report);
              const sellerRep = parseReport(r.seller_report);
              return (
                <div key={r.order_id} className="p-5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-black text-sm">Order #{r.order_id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.report_status === "pending" ? "bg-amber-500/10 text-amber-400" : r.report_status === "resolved" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>{r.report_status || "pending"}</span>
                        <span className="text-[9px] font-black text-blue-400 uppercase">Reported by {r.report_by}</span>
                      </div>
                      <p className="text-white/40 text-[10px] line-clamp-1">Product: {r.product_title || "—"}</p>
                    </div>
                    <span className="text-white/30 text-[10px] shrink-0">{timeAgo(r.created_at)}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {buyerRep && (
                      <div className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-4">
                        <p className="text-[9px] font-black uppercase tracking-widest text-rose-400 mb-2">Buyer Report — @{r.buyer_username}</p>
                        <p className="text-white/70 text-xs"><span className="text-white/40">Reason:</span> {buyerRep.reason}</p>
                        {buyerRep.custom_text && <p className="text-white/60 text-xs mt-1">{buyerRep.custom_text}</p>}
                      </div>
                    )}
                    {sellerRep && (
                      <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 mb-2">Seller Report — @{r.seller_username}</p>
                        <p className="text-white/70 text-xs"><span className="text-white/40">Reason:</span> {sellerRep.reason}</p>
                        {sellerRep.custom_text && <p className="text-white/60 text-xs mt-1">{sellerRep.custom_text}</p>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 mt-3 text-[10px] text-slate-500">
                    <span>Buyer: <span className="text-white/60 font-bold">@{r.buyer_username}</span></span>
                    <span>Seller: <span className="text-white/60 font-bold">@{r.seller_username}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
