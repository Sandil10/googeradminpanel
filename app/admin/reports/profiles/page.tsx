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

export default function ProfileReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/reports/profiles", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const d = await r.json();
      setReports(d.reports || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = reports.filter(r =>
    [r.reporter_username, r.reported_username, r.reason].some(f => String(f || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Profile Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">{reports.length} total reports</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none w-56" />
      </div>

      {reports.length === 0 && !loading && (
        <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] p-10 text-center">
          <p className="text-slate-500 text-sm mb-2">No profile reports yet.</p>
          <p className="text-slate-600 text-xs">Profile reports will appear here once users report each other via the profile page.</p>
        </div>
      )}

      {(loading || filtered.length > 0) && (
        <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] overflow-hidden">
          {loading ? (
            <div className="p-20 text-center text-slate-500 text-sm">Loading...</div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map(r => (
                <div key={r.id} className="p-5 flex items-start justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>{r.status || "pending"}</span>
                      <span className="text-white/30 text-[10px]">{timeAgo(r.created_at)}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
                      <span><span className="text-white/40">Reported:</span> <span className="text-white/70 font-bold">@{r.reported_username}</span></span>
                      <span><span className="text-white/40">By:</span> <span className="text-white/70 font-bold">@{r.reporter_username}</span></span>
                      <span><span className="text-white/40">Reason:</span> <span className="text-white/70">{r.reason}</span></span>
                    </div>
                    {r.custom_reason && <p className="text-white/50 text-xs mt-1">{r.custom_reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
