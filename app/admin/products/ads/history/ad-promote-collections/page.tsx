"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdsTransactionTable from "@/components/AdsTransactionTable";
import { adminService } from "@/services/adminService";

type Row = {
    id: number;
    ad_id: string | null;
    amount: string;
    commission: string;
    note: string;
    status: string;
    created_at: string;
    user_name: string;
    user_readable_id: string;
    username: string;
    ad_category: string;
    event_type: "credit" | "refund";
    signed_amount: string;
};

function formatTransactionTime(dateStr: string) {
    return new Intl.DateTimeFormat("en-LK", { timeZone: "Asia/Colombo",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    }).format(new Date(dateStr.includes("Z") || dateStr.includes("+") ? dateStr : dateStr + " UTC"));
}

function badgeClass(category: string) {
    if (category === "Product Promote") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    if (category === "Photo and Video") return "border-sky-500/20 bg-sky-500/10 text-sky-300";
    return "border-white/10 bg-white/[0.05] text-white/70";
}

export default function AdPromoteCollectionsHistoryPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    const loadRows = useCallback(async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const data = await adminService.fetchAdPromoteCollectionDetail();
            setRows(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRows(false);
        const interval = setInterval(() => loadRows(true), 5000);
        return () => clearInterval(interval);
    }, [loadRows]);

    const total = useMemo(
        () => rows.reduce((sum, row) => sum + parseFloat(row.signed_amount || "0"), 0),
        [rows]
    );

    return (
        <AdsTransactionTable
            eyebrow="Ads Transaction History"
            title="Photo / Product Promote"
            subtitle="Publish credits and refund reversals for photo-video and product promote ads"
            icon="images-outline"
            accentClassName="border-sky-500/20 bg-sky-500/[0.06]"
            summaryLabel="Net Ad Promote Balance"
            summaryValue={`R ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            summaryMeta={`${rows.length} ad collection event${rows.length !== 1 ? "s" : ""}`}
            loading={loading}
            emptyMessage="No photo or product promote collection records yet"
            rows={rows}
            columns={[
                {
                    label: "User",
                    render: (row) => (
                        <>
                            <p className="text-[11px] font-bold text-white">{row.user_name || "Unknown"}</p>
                            <p className="mt-0.5 text-[9px] text-white/40">@{row.username || "—"}</p>
                            <p className="mt-0.5 text-[9px] font-mono text-white/25">ID: {row.user_readable_id || "—"}</p>
                        </>
                    ),
                },
                {
                    label: "Category",
                    render: (row) => <span className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] ${badgeClass(row.ad_category)}`}>{row.ad_category}</span>,
                },
                {
                    label: "Event",
                    render: (row) => (
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] ${
                            row.event_type === "refund"
                                ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
                                : "border-sky-500/20 bg-sky-500/10 text-sky-300"
                        }`}>
                            {row.event_type === "refund" ? "Refund" : "Credit"}
                        </span>
                    ),
                },
                {
                    label: "Note",
                    render: (row) => <p className="max-w-[260px] text-[10px] text-white/55">{row.note || "—"}</p>,
                },
                {
                    label: "Amount",
                    headerClassName: "text-right",
                    cellClassName: "text-right",
                    render: (row) => {
                        const signed = parseFloat(row.signed_amount || "0");
                        return (
                            <span className={`text-[11px] font-black ${signed < 0 ? "text-rose-300" : "text-sky-300"}`}>
                                {signed < 0 ? "-R" : "+R"} {Math.abs(signed).toFixed(2)}
                            </span>
                        );
                    },
                },
                {
                    label: "When",
                    headerClassName: "text-right",
                    cellClassName: "text-right",
                    render: (row) => (
                        <>
                            <p className="text-[10px] font-bold text-white/40">{formatTransactionTime(row.created_at)}</p>
                            </>
                    ),
                },
            ]}
        />
    );
}




