"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdsTransactionTable from "@/components/AdsTransactionTable";
import { adminService } from "@/services/adminService";

type Row = {
    ad_id: string;
    ad_type: string;
    commission: string;
    reward_amount: string;
    advertiser_charge: string;
    created_at: string;
    advertiser_id: string;
    advertiser_name: string;
    collector_user_id: string;
    collector_name: string;
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

export default function AdCoinCollectionsHistoryPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    const loadRows = useCallback(async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const data = await adminService.fetchCoinCollectDetail();
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
        () => rows.reduce((sum, row) => sum + parseFloat(row.commission || "0"), 0),
        [rows]
    );

    return (
        <AdsTransactionTable
            eyebrow="Ads Transaction History"
            title="Ad Coin Collections"
            subtitle="Googer earnings from ad coin collection rewards"
            icon="logo-bitcoin"
            accentClassName="border-emerald-500/20 bg-emerald-500/[0.06]"
            summaryLabel="Total Googer Commission Earned"
            summaryValue={`R ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            summaryMeta={`${rows.length} collection event${rows.length !== 1 ? "s" : ""}`}
            loading={loading}
            emptyMessage="No ad coin collection records yet"
            rows={rows}
            columns={[
                {
                    label: "Ad",
                    render: (row) => (
                        <>
                            <p className="text-[10px] font-black text-white/80 font-mono">{row.ad_id || "—"}</p>
                            <p className="mt-0.5 text-[9px] uppercase tracking-widest text-white/30">{row.ad_type || "—"}</p>
                        </>
                    ),
                },
                {
                    label: "Advertiser",
                    render: (row) => (
                        <>
                            <p className="text-[11px] font-bold text-white">{row.advertiser_name || "Unknown"}</p>
                            <p className="mt-0.5 text-[9px] font-mono text-white/25">ID: {row.advertiser_id || "—"}</p>
                        </>
                    ),
                },
                {
                    label: "Collector",
                    render: (row) => (
                        <>
                            <p className="text-[11px] font-bold text-white">{row.collector_name || "Unknown"}</p>
                            <p className="mt-0.5 text-[9px] font-mono text-white/25">ID: {row.collector_user_id || "—"}</p>
                        </>
                    ),
                },
                {
                    label: "Googer Cut",
                    headerClassName: "text-right",
                    cellClassName: "text-right",
                    render: (row) => <span className="text-[11px] font-black text-emerald-400">+R {parseFloat(row.commission || "0").toFixed(2)}</span>,
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




