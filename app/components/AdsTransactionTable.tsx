"use client";

import { useEffect, useMemo, useState } from "react";
import IonIcon from "@/components/IonIcon";

const PAGE_SIZE = 10;

type Column<T> = {
    label: string;
    headerClassName?: string;
    cellClassName?: string;
    render: (row: T) => React.ReactNode;
};

type Props<T> = {
    eyebrow: string;
    title: string;
    subtitle: string;
    icon: string;
    accentClassName: string;
    summaryLabel: string;
    summaryValue: string;
    summaryMeta: string;
    loading: boolean;
    emptyMessage: string;
    columns: Column<T>[];
    rows: T[];
};

export function useLiveRelativeTime() {
    const [, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000 * 30);

        return () => clearInterval(interval);
    }, []);
}

export default function AdsTransactionTable<T>({
    eyebrow,
    title,
    subtitle,
    icon,
    accentClassName,
    summaryLabel,
    summaryValue,
    summaryMeta,
    loading,
    emptyMessage,
    columns,
    rows,
}: Props<T>) {
    const [page, setPage] = useState(1);

    useLiveRelativeTime();

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

    useEffect(() => {
        setPage((currentPage) => Math.min(currentPage, totalPages));
    }, [totalPages]);

    const pagedRows = useMemo(
        () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [page, rows]
    );

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">{eyebrow}</p>
                <h1 className="text-base font-black uppercase tracking-tight text-white">{title}</h1>
                <p className="mt-1 text-[10px] font-semibold text-white/40">{subtitle}</p>
            </div>

            <div className={`rounded-[1.75rem] border p-5 flex items-center justify-between ${accentClassName}`}>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/70 mb-1">{summaryLabel}</p>
                    <p className="text-2xl font-black text-white">{summaryValue}</p>
                    <p className="text-[9px] text-white/40 mt-1">{summaryMeta}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                    <IonIcon name={icon} className="text-2xl text-white" />
                </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</div>
                ) : rows.length === 0 ? (
                    <div className="p-12 text-center">
                        <IonIcon name={icon} className="text-4xl text-white/10 block mx-auto mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/25">{emptyMessage}</p>
                    </div>
                ) : (
                    <>
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-white/[0.06] text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                                        {columns.map((column) => (
                                            <th key={column.label} className={`px-6 py-4 ${column.headerClassName || ""}`}>
                                                {column.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {pagedRows.map((row, index) => (
                                        <tr
                                            key={typeof row === "object" && row !== null && "id" in row ? String((row as { id: string | number }).id) : index}
                                            className="hover:bg-white/[0.02] transition-colors"
                                        >
                                            {columns.map((column) => (
                                                <td key={column.label} className={`px-6 py-4 ${column.cellClassName || ""}`}>
                                                    {column.render(row)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/30">
                                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                                    disabled={page === 1}
                                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                                >
                                    Prev
                                </button>
                                <span className="text-[10px] font-black uppercase tracking-[0.08em] text-white/40">
                                    Page {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                                    disabled={page === totalPages}
                                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
