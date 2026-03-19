"use client";

import { useEffect, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Transaction {
    id: number;
    sender_id: number;
    receiver_id: number;
    amount: string;
    commission: string;
    commission_percentage: number;
    type: string;
    status: string;
    payment_method: string;
    note: string;
    description: string;
    created_at: string;
    sender_username?: string;
    sender_full_name?: string;
    sender_readable_id?: string;
    receiver_username?: string;
    receiver_full_name?: string;
    receiver_readable_id?: string;
}

export default function TransactionsTable() {
    const pathname = usePathname();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        loadTransactions();
    }, []);

    const loadTransactions = async () => {
        try {
            setLoading(true);
            const data = await adminService.fetchAllTransactions();
            setTransactions(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredTransactions = transactions.filter(tx => {
        if (!searchTerm) return true;
        try {
            const search = searchTerm.toLowerCase();
            const id = tx.id.toString();
            const sender = (tx.sender_username || '').toLowerCase();
            const receiver = (tx.receiver_username || '').toLowerCase();
            const senderFull = (tx.sender_full_name || '').toLowerCase();
            const receiverFull = (tx.receiver_full_name || '').toLowerCase();
            const senderRid = (tx.sender_readable_id || '').toLowerCase();
            const receiverRid = (tx.receiver_readable_id || '').toLowerCase();
            const noteText = (tx.note || tx.description || '').toLowerCase();

            return id.includes(search) || 
                   sender.includes(search) || 
                   receiver.includes(search) ||
                   senderFull.includes(search) ||
                   receiverFull.includes(search) ||
                   senderRid.includes(search) ||
                   receiverRid.includes(search) ||
                   noteText.includes(search);
        } catch (e) {
            return false;
        }
    });

    // Pagination
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Reset pagination on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#09090b] border border-[#1a1a1a] p-6 rounded-[2.5rem] shadow-xl relative z-20">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 text-xl border border-blue-500/20">
                        <IonIcon name="receipt-outline" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">System Transactions</h2>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-0.5">Complete financial audit log</p>
                    </div>
                </div>
                
                <div className="relative flex-1 max-w-md">
                    <IonIcon name="search-outline" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg" />
                    <input 
                        type="text"
                        placeholder="Search ID, Username, or Full Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all font-sans"
                    />
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/[0.02]">
                                <th className="px-8 py-5">TX ID</th>
                                <th className="px-8 py-5">Participants (From → To)</th>
                                <th className="px-8 py-5 text-center">Type</th>
                                <th className="px-8 py-5 text-center">Status</th>
                                <th className="px-8 py-5 text-right">Amount / Info</th>
                                <th className="px-8 py-5 text-right">Date & Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-8 py-10 h-24 text-center">
                                            <div className="h-4 bg-white/5 rounded w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : paginatedTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <IonIcon name="receipt-outline" className="text-4xl text-slate-700 mb-4" />
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">No Transactions Found</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedTransactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-black text-slate-600 group-hover:text-blue-400 transition-colors">#{tx.id}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                    <Link href={`/admin/users/${tx.sender_id}?returnTo=${pathname}&from=Transactions`} className="text-xs font-bold text-white hover:text-blue-400 transition-colors">
                                                        @{tx.sender_username || 'System'}
                                                    </Link>
                                                    <span className="text-[10px] text-slate-500">ID: {tx.sender_readable_id || 'N/A'}</span>
                                                </div>
                                                <IonIcon name="arrow-forward-outline" className="text-slate-700 mx-2" />
                                                <div className="flex flex-col">
                                                    <Link href={`/admin/users/${tx.receiver_id}?returnTo=${pathname}&from=Transactions`} className="text-xs font-bold text-white hover:text-blue-400 transition-colors">
                                                        @{tx.receiver_username || 'System'}
                                                    </Link>
                                                    <span className="text-[10px] text-slate-500">ID: {tx.receiver_readable_id || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`text-[9px] uppercase font-black px-2.5 py-1 rounded-md border ${
                                                tx.type === 'transfer' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                tx.type === 'request' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                tx.type === 'sell' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                'bg-white/5 text-white border-white/10'
                                            }`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`text-[9px] uppercase font-bold ${
                                                tx.status === 'completed' || tx.status === 'accepted' ? 'text-emerald-500' : 
                                                tx.status === 'pending' ? 'text-amber-500' : 'text-rose-500'
                                            }`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="text-sm font-black text-white tracking-tighter">
                                                R {parseFloat(tx.amount).toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium italic max-w-[200px] ml-auto truncate">
                                                {tx.note || tx.description || 'Reference: System Audit'}
                                                {tx.commission_percentage > 0 && ` (-${tx.commission_percentage}% Disc)`}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-none mb-1">
                                                {new Date(tx.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-medium">
                                                {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {!loading && totalPages > 1 && (
                    <div className="px-8 py-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
                        </p>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="w-10 h-10 rounded-xl bg-black border border-white/5 flex items-center justify-center text-white hover:border-blue-500/30 disabled:opacity-30 disabled:hover:border-white/5 transition-all active:scale-95"
                            >
                                <IonIcon name="chevron-back" />
                            </button>
                            
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = i + 1;
                                    if (totalPages > 5) {
                                        if (currentPage > 3) {
                                            pageNum = currentPage - 2 + i;
                                            if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                                        }
                                    }
                                    if (pageNum <= totalPages) {
                                        return (
                                            <button 
                                                key={pageNum}
                                                onClick={() => handlePageChange(pageNum)}
                                                className={`w-10 h-10 rounded-xl font-bold text-[10px] transition-all border ${
                                                    currentPage === pageNum ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' : 'bg-black text-slate-400 border-white/5 hover:border-white/20'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    }
                                    return null;
                                })}
                            </div>

                            <button 
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="w-10 h-10 rounded-xl bg-black border border-white/5 flex items-center justify-center text-white hover:border-blue-500/30 disabled:opacity-30 disabled:hover:border-white/5 transition-all active:scale-95"
                            >
                                <IonIcon name="chevron-forward" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
