"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import IonIcon from "../../components/IonIcon";
import { adminService } from "../../services/adminService";

interface User {
  id: number;
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  user_type: string;
  wallet_balance: string;
  status: string;
  created_at: string;
  profile_picture?: string;
  is_verified?: boolean;
  verification_status?: string;
}

const TYPE_COLORS: Record<string, string> = {
  admin:    "bg-orange-500/10 text-orange-400 border-orange-500/20",
  employee: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  seller:   "bg-purple-500/10 text-purple-400 border-purple-500/20",
  buyer:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  user:     "bg-white/5 text-slate-400 border-white/5",
};

const VERIF_COLORS: Record<string, string> = {
  "Verified":     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Under Review": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Rejected":     "bg-rose-500/10 text-rose-400 border-rose-500/20",
  "None":         "bg-white/5 text-slate-500 border-white/5",
};

const VERIF_ICONS: Record<string, string> = {
  "Verified":     "checkmark-circle",
  "Under Review": "time",
  "Rejected":     "close-circle",
  "None":         "ellipse-outline",
};

const FILTER_TYPES = ["All", "Admin", "Employee", "Seller", "Buyer"] as const;
type FilterType = typeof FILTER_TYPES[number];

const VERIF_FILTERS = ["All", "None", "Under Review", "Verified", "Rejected"] as const;
type VerifFilter = typeof VERIF_FILTERS[number];

export default function VerificationPage() {
  const pathname = usePathname();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("All");
  const [filterVerif, setFilterVerif] = useState<VerifFilter>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adminService.fetchAllUsers()
      .then((data: User[]) => setUsers(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const visible = users.filter(u => {
    if (u.username?.toLowerCase() === "admin") return false;
    if (filterType !== "All" && u.user_type?.toLowerCase() !== filterType.toLowerCase()) return false;
    const vs = u.verification_status || "None";
    if (filterVerif !== "All" && vs !== filterVerif) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        u.user_id?.toLowerCase().includes(s) ||
        u.full_name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const counts = {
    underReview: users.filter(u => u.verification_status === "Under Review").length,
    verified:    users.filter(u => u.verification_status === "Verified").length,
    rejected:    users.filter(u => u.verification_status === "Rejected").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">User Verification</h1>
        <p className="text-slate-400 text-sm font-medium mt-0.5">Review and manage identity verification requests.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Under Review", count: counts.underReview, color: "text-amber-400", dot: "bg-amber-400", filter: "Under Review" as VerifFilter },
          { label: "Verified",     count: counts.verified,    color: "text-emerald-400", dot: "bg-emerald-400", filter: "Verified" as VerifFilter },
          { label: "Rejected",     count: counts.rejected,    color: "text-rose-400",    dot: "bg-rose-400",    filter: "Rejected" as VerifFilter },
        ].map(stat => (
          <button
            key={stat.label}
            onClick={() => setFilterVerif(v => v === stat.filter ? "All" : stat.filter)}
            className={`bg-[#09090b] border rounded-2xl px-4 sm:px-5 py-4 text-left transition-all hover:border-white/10 flex sm:block items-center sm:items-start justify-between sm:justify-start gap-3 ${
              filterVerif === stat.filter ? "border-white/15 bg-white/[0.02]" : "border-[#1a1a1a]"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${stat.dot}`} />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
            </div>
            <p className={`text-xl sm:text-2xl font-black ${stat.color}`}>{stat.count}</p>
          </button>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] relative min-h-[500px] shadow-2xl overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-[2rem]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white" />
          </div>
        )}

        {/* Search + Filter bar */}
        <div className="p-6 border-b border-[#1a1a1a] flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
              <IonIcon name="search-outline" className="text-lg" />
            </div>
            <input
              type="text"
              placeholder="Search by User ID, Name or Email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all"
            />
          </div>

          <div ref={filterRef} className="relative">
            <button
              onClick={() => setFilterOpen(v => !v)}
              className={`h-11 w-11 rounded-xl border flex items-center justify-center transition-all ${
                filterType !== "All"
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                  : "bg-white/5 border-white/5 text-slate-400 hover:border-blue-500/30 hover:text-blue-400"
              }`}
            >
              <IonIcon name="filter-outline" className="text-base" />
            </button>

            {filterOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-44 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl z-[70] py-2 overflow-hidden">
                  <p className="px-4 py-2 text-[8px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">Filter by Role</p>
                  {FILTER_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => { setFilterType(type); setFilterOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors ${
                        filterType === type ? "text-blue-400 bg-white/5" : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {filterType === type && <IonIcon name="checkmark-outline" className="text-xs" />}
                      <span className={filterType === type ? "" : "ml-4"}>{type}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="px-4 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2.5 shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{visible.length} Users</span>
          </div>
        </div>

        {/* Active filter chips */}
        {(filterType !== "All" || filterVerif !== "All") && (
          <div className="px-6 py-2 flex items-center gap-2 border-b border-[#1a1a1a] flex-wrap">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Filtered:</span>
            {filterType !== "All" && (
              <button
                onClick={() => setFilterType("All")}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-widest hover:bg-blue-500/20 transition-all"
              >
                {filterType} <IonIcon name="close-outline" className="text-xs" />
              </button>
            )}
            {filterVerif !== "All" && (
              <button
                onClick={() => setFilterVerif("All")}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[9px] font-black text-purple-400 uppercase tracking-widest hover:bg-purple-500/20 transition-all"
              >
                {filterVerif} <IonIcon name="close-outline" className="text-xs" />
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#1a1a1a]/50 text-slate-300 text-[9px] font-black uppercase tracking-[0.2em]">
                <th className="px-6 py-5">User</th>
                <th className="px-6 py-5 text-center">Verification Status</th>
                <th className="px-6 py-5 text-center">Account Status</th>
                <th className="px-6 py-5 text-right">Joined</th>
                <th className="px-6 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500 font-medium italic">
                    {searchTerm || filterType !== "All" || filterVerif !== "All"
                      ? "No users match your search or filter."
                      : "No users registered yet."}
                  </td>
                </tr>
              ) : (
                visible.map(user => {
                  const typeKey = user.user_type?.toLowerCase() ?? "user";
                  const vs = user.verification_status || "None";
                  const verifColor = VERIF_COLORS[vs] ?? VERIF_COLORS["None"];
                  const verifIcon  = VERIF_ICONS[vs]  ?? "ellipse-outline";
                  return (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-all group">
                      {/* User info */}
                      <td className="px-6 py-5">
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 overflow-hidden shrink-0">
                            <IonIcon name="person" className="text-xl" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Link
                                href={`/admin/users/${user.id}?returnTo=${pathname}&from=Verification`}
                                className="font-bold text-white text-sm hover:text-blue-400 transition-colors"
                              >
                                {user.user_type?.toLowerCase() === 'admin' ? `@${user.username}` : user.full_name}
                              </Link>
                              <span className="text-[10px] text-slate-500 font-mono">ID: {user.user_id}</span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">@{user.username}</p>
                            <p className="text-[11px] text-slate-500 italic mt-0.5">{user.email}</p>
                            <span className={`inline-block mt-2 px-3 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${TYPE_COLORS[typeKey] ?? TYPE_COLORS.user}`}>
                              {user.user_type}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Verification status */}
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${verifColor}`}>
                          <IonIcon name={verifIcon} className="text-xs" />
                          {vs}
                        </span>
                      </td>

                      {/* Account status */}
                      <td className="px-6 py-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{user.status || "Active"}</span>
                        </div>
                      </td>

                      {/* Joined */}
                      <td className="px-6 py-5 text-right">
                        <p className="text-[10px] font-bold text-slate-400">
                          {new Date(user.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-[9px] text-slate-600 mt-0.5 font-mono">
                          {new Date(user.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>

                      {/* Verify action button */}
                      <td className="px-6 py-5 text-right">
                        {vs === "None" ? (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-white/5 border-white/5 text-slate-600 cursor-default">
                            <IonIcon name="ellipse-outline" className="text-sm" />
                            No Request
                          </span>
                        ) : (
                          <Link
                            href={`/admin/verification/${user.id}`}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                              vs === "Under Review"
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                                : vs === "Verified"
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                            }`}
                          >
                            <IonIcon name="shield-checkmark-outline" className="text-sm" />
                            {vs === "Under Review" ? "Review" : "View"}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
