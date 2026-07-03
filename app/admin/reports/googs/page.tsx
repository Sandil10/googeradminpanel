"use client";
import { useEffect, useState } from "react";
import IonIcon from "../../../components/IonIcon";

function timeAgo(v: string) {
  const d = Date.now() - new Date(v).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function GoogReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/reports/googs", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const d = await r.json();
      setReports(d.reports || []);
    } catch { } finally { setLoading(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/reports/googs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: JSON.stringify({ status }),
    });
    load();
  };

  useEffect(() => { load(); }, []);

  const filtered = reports.filter(r =>
    [r.reporter_username, r.goog_owner_username, r.reason, r.goog_content].some(f => String(f || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Goog Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">{reports.length} total reports</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports..." className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none w-56" />
      </div>

      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] overflow-hidden">
        {loading ? (
          <div className="p-20 text-center text-slate-500 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-20 text-center text-slate-500 text-sm">No reports found.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(r => (
              <div key={r.id} className="p-5 flex flex-col gap-2 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.status === "pending" ? "bg-amber-500/10 text-amber-400" : r.status === "reviewed" ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"}`}>{r.status || "pending"}</span>
                      <span className="text-white/30 text-[10px]">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-white/80 text-xs leading-relaxed line-clamp-2 mb-2">"{r.goog_content || "—"}"</p>
                    <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
                      <span><span className="text-white/40">Post by:</span> <span className="text-white/70 font-bold">@{r.goog_owner_username || "—"}</span></span>
                      <span><span className="text-white/40">Reported by:</span> <span className="text-white/70 font-bold">@{r.reporter_username || "—"}</span></span>
                      <span><span className="text-white/40">Reason:</span> <span className="text-white/70 font-bold">{r.reason}</span></span>
                      {r.custom_reason && <span><span className="text-white/40">Note:</span> <span className="text-white/70">{r.custom_reason}</span></span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => updateStatus(r.id, "reviewed")} className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition">Reviewed</button>
                    <button onClick={() => updateStatus(r.id, "dismissed")} className="px-3 py-1.5 rounded-xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition">Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
