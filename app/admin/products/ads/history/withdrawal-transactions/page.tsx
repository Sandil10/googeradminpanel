"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdsTransactionTable from "@/components/AdsTransactionTable";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

type WalletTx = {
    id: number;
    type: "withdrawal_hold" | "withdrawal_refund";
    amount: string;
    note: string | null;
    status: string;
    created_at: string;
    sender_name: string | null;
    sender_username: string | null;
    sender_readable_id: string | null;
    receiver_name: string | null;
    receiver_username: string | null;
    receiver_readable_id: string | null;
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

export default function WithdrawalTransactionsPage() {
    const [rows, setRows] = useState<WalletTx[]>([]);
    const [loading, setLoading] = useState(true);

    const loadRows = useCallback(async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const data = await adminService.fetchWithdrawalTransactions();
            setRows(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRows(false);
        const interval = setInterval(() => loadRows(true), 10000);
        return () => clearInterval(interval);
    }, [loadRows]);

    const totals = useMemo(() => {
        const withdrawn = rows
            .filter(r => r.type === "withdrawal_hold")
            .reduce((s, r) => s + parseFloat(r.amount || "0"), 0);
        const refunded = rows
            .filter(r => r.type === "withdrawal_refund")
            .reduce((s, r) => s + parseFloat(r.amount || "0"), 0);
        return { withdrawn, refunded, net: withdrawn - refunded };
    }, [rows]);

    return (
        <AdsTransactionTable
            eyebrow="Transaction History"
            title="Withdrawal Transactions"
            subtitle="All wallet deductions and refunds linked to withdrawal requests"
            icon="arrow-up-circle-outline"
            accentClassName="border-rose-500/20 bg-rose-500/[0.06]"
            summaryLabel="Net Withdrawn"
            summaryValue={`−R ${totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            summaryMeta={`${rows.filter(r => r.type === "withdrawal_hold").length} withdrawals · ${rows.filter(r => r.type === "withdrawal_refund").length} refunds`}
            loading={loading}
            emptyMessage="No withdrawal transactions yet"
            rows={rows}
            columns={[
                {
                    label: "User",
                    render: (row) => {
                        const isRefund = row.type === "withdrawal_refund";
                        const name     = isRefund ? row.receiver_name     : row.sender_name;
                        const username = isRefund ? row.receiver_username : row.sender_username;
                        const uid      = isRefund ? row.receiver_readable_id : row.sender_readable_id;
                        return (
                            <>
                                <p className="text-[11px] font-bold text-white">{name || "Unknown"}</p>
                                <p className="mt-0.5 text-[9px] text-white/40">@{username || "—"}</p>
                                <p className="mt-0.5 text-[9px] font-mono text-white/25">ID: {uid || "—"}</p>
                            </>
                        );
                    },
                },
                {
                    label: "Type",
                    headerClassName: "text-center",
                    cellClassName: "text-center",
                    render: (row) => {
                        const isRefund = row.type === "withdrawal_refund";
                        return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                isRefund
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            }`}>
                                <IonIcon name={isRefund ? "return-up-back-outline" : "arrow-up-circle-outline"} className="text-xs" />
                                {isRefund ? "Refund" : "Withdrawal"}
                            </span>
                        );
                    },
                },
                {
                    label: "Status",
                    headerClassName: "text-center",
                    cellClassName: "text-center",
                    render: (row) => (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                            row.status === "accepted"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : row.status === "refunded"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-white/5 text-slate-400 border-white/5"
                        }`}>
                            {row.status}
                        </span>
                    ),
                },
                {
                    label: "Note",
                    render: (row) => (
                        <p className="max-w-[220px] text-[10px] text-white/50 truncate">{row.note || "—"}</p>
                    ),
                },
                {
                    label: "Amount",
                    headerClassName: "text-right",
                    cellClassName: "text-right",
                    render: (row) => {
                        const isRefund = row.type === "withdrawal_refund";
                        return (
                            <span className={`text-[12px] font-black ${isRefund ? "text-emerald-400" : "text-rose-400"}`}>
                                {isRefund ? "+" : "−"}R {parseFloat(row.amount || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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




