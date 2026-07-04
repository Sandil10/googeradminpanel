"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdsTransactionTable from "@/components/AdsTransactionTable";
import { adminService } from "@/services/adminService";

type Row = {
    id: number;
    transfer_amount: string;
    note: string;
    created_at: string;
    sender_name: string;
    username: string;
    user_readable_id: string;
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

export default function CapitalTransferHistoryPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    const loadRows = useCallback(async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const data = await adminService.fetchCapitalTransferHistory();
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
        () => rows.reduce((sum, row) => sum + parseFloat(row.transfer_amount || "0"), 0),
        [rows]
    );

    return (
        <AdsTransactionTable
            eyebrow="Ads Transaction History"
            title="Capital Transfer"
            subtitle="Wallet to Googer transfer records"
            icon="arrow-up-circle-outline"
            accentClassName="border-yellow-500/20 bg-yellow-500/[0.06]"
            summaryLabel="Total Capital Transferred"
            summaryValue={`R ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            summaryMeta={`${rows.length} transfer${rows.length !== 1 ? "s" : ""}`}
            loading={loading}
            emptyMessage="No capital transfer records yet"
            rows={rows}
            columns={[
                {
                    label: "Admin",
                    render: (row) => (
                        <>
                            <p className="text-[11px] font-bold text-white">{row.sender_name || "Unknown"}</p>
                            <p className="mt-0.5 text-[9px] text-white/40">@{row.username || "—"}</p>
                            <p className="mt-0.5 text-[9px] font-mono text-white/25">ID: {row.user_readable_id || "—"}</p>
                        </>
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
                    render: (row) => <span className="text-[11px] font-black text-yellow-400">R {parseFloat(row.transfer_amount || "0").toFixed(2)}</span>,
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




