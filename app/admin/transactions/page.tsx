"use client";

import TransactionsTable from "@/components/TransactionsTable";

export default function AllTransactionsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <TransactionsTable />
        </div>
    );
}
