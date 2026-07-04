"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

type PromoteRow = {
    id: number;
    amount: string;
    commission: string;
    note: string;
    created_at: string;
    user_name: string;
    user_readable_id: string;
    username: string;
};

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function ProfilePromoteDetailPage() {
    const router = useRouter();
    const [rows, setRows] = useState<PromoteRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        adminService.fetchProfilePromoteDetail()
            .then((data: PromoteRow[]) => {
                setRows(data);
                const sum = data.reduce((acc, r) => acc + parseFloat(r.commission || "0"), 0);
                setTotal(sum);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white"
                >
                    <IonIcon name="chevron-back-outline" className="text-base" />
                </button>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Googer Income</p>
                    <h1 className="text-base font-black uppercase tracking-tight text-white">Profile Promote Ads</h1>
                </div>
            </div>

            {/* Summary card */}
            <div className="rounded-[1.75rem] border border-violet-500/20 bg-violet-500/[0.06] p-5 flex items-center justify-between">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-400/70 mb-1">Total Googer Income from Profile Ads</p>
                    <p className="text-2xl font-black text-white">
                        R {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] text-white/30 mt-1">{rows.length} ad publication{rows.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                    <IonIcon name="person-circle-outline" className="text-2xl text-violet-400" />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-white/25">
                        Loading...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-12 text-center">
                        <IonIcon name="person-circle-outline" className="text-4xl text-white/10 block mx-auto mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/25">No profile promote ads yet</p>
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/[0.06] text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Note</th>
                                    <th className="px-6 py-4 text-right">Ad Amount</th>
                                    <th className="px-6 py-4 text-right">Googer Income</th>
                                    <th className="px-6 py-4 text-right">When</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-[11px] font-bold text-white">{row.user_name || "Unknown"}</p>
                                            <p className="text-[9px] text-white/40 mt-0.5">@{row.username || "—"}</p>
                                            <p className="text-[9px] font-mono text-white/25 mt-0.5">ID: {row.user_readable_id || "—"}</p>
                                        </td>
                                        <td className="px-6 py-4 max-w-[200px]">
                                            <p className="text-[10px] text-white/50 truncate">{row.note || "—"}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-[11px] font-black text-white/70">
                                                R {parseFloat(row.amount || "0").toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-[11px] font-black text-violet-400">
                                                +R {parseFloat(row.commission || "0").toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="text-[10px] font-bold text-white/40">{timeAgo(row.created_at)}</p>
                                            <p className="text-[9px] text-white/20 mt-0.5">
                                                {new Date(row.created_at).toLocaleDateString()}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
