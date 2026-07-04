"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdsTransactionTable from "@/components/AdsTransactionTable";
import { adminService } from "@/services/adminService";

type Row = {
    order_id: number;
    order_status: string;
    commission_amount: string;
    transfer_status: string;
    note: string | null;
    created_at: string;
    seller_name: string | null;
    seller_username: string | null;
    seller_readable_id: string | null;
    buyer_name: string | null;
    buyer_username: string | null;
    buyer_readable_id: string | null;
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

export default function ProductCommissionsHistoryPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    const loadRows = useCallback(async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const data = await adminService.fetchProductCommissionHistory();
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
        () => rows.reduce((sum, row) => sum + parseFloat(row.commission_amount || "0"), 0),
        [rows]
    );

    return (
        <AdsTransactionTable
            eyebrow="Ads Transaction History"
            title="Product Commission"
            subtitle="Commission history routed to Googer from completed orders"
            icon="pricetags-outline"
            accentClassName="border-rose-500/20 bg-rose-500/[0.06]"
            summaryLabel="Total Product Commission"
            summaryValue={`R ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            summaryMeta={`${rows.length} commission record${rows.length !== 1 ? "s" : ""}`}
            loading={loading}
            emptyMessage="No product commission records yet"
            rows={rows}
            columns={[
                {
                    label: "Order",
                    render: (row) => (
                        <>
                            <p className="text-[10px] font-black text-white/80 font-mono">#{row.order_id}</p>
                            <p className="mt-0.5 text-[9px] uppercase tracking-widest text-white/30">{row.order_status || "—"}</p>
                        </>
                    ),
                },
                {
                    label: "Seller / Buyer",
                    render: (row) => (
                        <>
                            <p className="text-[10px] font-bold text-white">Seller: {row.seller_name || "Unknown"}</p>
                            <p className="mt-0.5 text-[9px] text-white/40">Buyer: {row.buyer_name || "Unknown"}</p>
                        </>
                    ),
                },
                {
                    label: "Note",
                    render: (row) => <p className="max-w-[220px] text-[10px] text-white/55">{row.note || "Product commission transfer"}</p>,
                },
                {
                    label: "Commission",
                    headerClassName: "text-right",
                    cellClassName: "text-right",
                    render: (row) => <span className="text-[11px] font-black text-rose-300">R {parseFloat(row.commission_amount || "0").toFixed(2)}</span>,
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




