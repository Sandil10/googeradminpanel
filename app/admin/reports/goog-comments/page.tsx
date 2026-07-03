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

export default function GoogCommentReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/reports/goog-comments", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const d = await r.json();
      setReports(d.reports || []);
    } catch { } finally { setLoading(false); }
  };

  const deleteComment = async (id: number) => {
    if (!confirm("Delete this comment?")) return;
    await fetch(`/api/reports/goog-comments/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    load();
  };

  useEffect(() => { load(); }, []);

  const filtered = reports.filter(r =>
    [r.commenter_username, r.content, r.goog_content].some(f => String(f || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Goog Comment Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">{reports.length} reported comments</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none w-56" />
      </div>

      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] overflow-hidden">
        {loading ? (
          <div className="p-20 text-center text-slate-500 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-20 text-center text-slate-500 text-sm">No reported comments.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(r => (
              <div key={r.id} className="p-5 flex items-start justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400">{r.reports} report{r.reports !== 1 ? "s" : ""}</span>
                    <span className="text-white/30 text-[10px]">{timeAgo(r.created_at)}</span>
                  </div>
                  <p className="text-white/80 text-xs leading-relaxed mb-1">"{r.content}"</p>
                  <p className="text-white/30 text-[10px] line-clamp-1 mb-2">On goog: "{r.goog_content || "—"}"</p>
                  <span className="text-[10px] text-slate-500">By <span className="text-white/60 font-bold">@{r.commenter_username || "—"}</span></span>
                </div>
                <button onClick={() => deleteComment(r.id)} className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition shrink-0">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
