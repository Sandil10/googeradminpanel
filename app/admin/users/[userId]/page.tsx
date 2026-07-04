"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toManagedMediaUrl } from "../../../utils/mediaUrl";

interface Transaction {
  id: number;
  sender_id: number;
  receiver_id: number;
  amount: string;
  commission: string;
  type: string;
  status: string;
  payment_method: string;
  description: string;
  created_at: string;
  sender_username?: string;
  sender_full_name?: string;
  sender_readable_id?: string;
  receiver_username?: string;
  receiver_full_name?: string;
  receiver_readable_id?: string;
  note?: string;
  commission_percentage?: number;
}

interface UserProfile {
  id: number;
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  user_type: string;
  wallet_balance: string;
  hold_balance: string;
  status: string;
  bio: string;
  profile_picture: string;
  created_at: string;
}

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const returnLabel = searchParams.get('from') || 'Back';
  
  const { userId } = use(params);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalEarnings, setTotalEarnings] = useState("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBalanceDetails, setShowBalanceDetails] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [txSearchTerm, setTxSearchTerm] = useState("");
  const [txPage, setTxPage] = useState(1);
  const txPerPage = 10;

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const userData = await adminService.fetchUserDetails(userId);
        setUser(userData);
        
        // Fetch transactions
        const transData = await adminService.fetchUserTransactions(userData.id.toString());
        setTransactions(transData.transactions || []);
        setTotalEarnings(transData.totalEarnings || "0");
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [userId]);

  const handleStatusToggle = async () => {
    if (!user) return;
    try {
      const newStatus = user.status === 'Active' ? 'Deactivated' : 'Active';
      await adminService.updateUserStatus(user.id.toString(), newStatus);
      setUser({ ...user, status: newStatus });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-white">Loading profile...</div>;
  if (error || !user) return <div className="p-8 text-rose-500">Error: {error || "User not found"}</div>;

  const profileImage = user.profile_picture
    ? (toManagedMediaUrl(user.profile_picture) || user.profile_picture)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&size=200&background=random`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header / Cover */}
      <div className="relative h-48 bg-[#1a1a1a] rounded-3xl overflow-hidden border border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-transparent to-blue-600/20"></div>
        <button 
            onClick={() => returnTo ? router.push(returnTo) : router.back()}
            className="absolute top-6 left-6 flex items-center gap-2 text-xs font-bold text-white/50 hover:text-white transition-colors bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 active:scale-95 z-20"
        >
            <IonIcon name="arrow-back" />
            {returnLabel === 'Products' ? 'Back to Products' : returnTo ? 'Go Back' : 'Go Back'}
        </button>
      </div>

      {/* Main Stats Card */}
      <div className="relative px-8">
        <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2.5rem] p-8 -mt-24 shadow-2xl relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar */}
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-8 border-[#09090b] shadow-2xl bg-slate-800 shrink-0">
              <Image
                unoptimized
                src={profileImage}
                alt={user.full_name}
                fill
                className="object-cover"
              />
            </div>

            {/* Basic Info */}
            <div className="flex-1 space-y-4 pt-4">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tight">{user.user_type?.toLowerCase() === 'admin' ? `@${user.username}` : user.full_name}</h1>
                  <p className="text-slate-400 font-medium">@{user.username} • User ID: {user.user_id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a
                        href={`https://app.infranex.it.com/profile/${user.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all flex items-center gap-1.5 active:scale-95"
                    >
                        <IonIcon name="open-outline" />
                        View Profile
                    </a>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        user.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                        {user.status}
                    </span>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        user.user_type?.toLowerCase() === 'admin' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        user.user_type?.toLowerCase() === 'seller' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        user.user_type?.toLowerCase() === 'employee' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-white/10 text-white border-white/5'
                    }`}>
                        {user.user_type?.toLowerCase() === 'admin' ? 'Admin' : 
                         user.user_type?.toLowerCase() === 'seller' ? 'Seller' :
                         user.user_type?.toLowerCase() === 'employee' ? 'Employee' : 'User'}
                    </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <IonIcon name="mail-outline" className="text-blue-400" />
                  {user.email}
                </div>
                <div className="flex items-center gap-2">
                  <IonIcon name="calendar-outline" className="text-purple-400" />
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </div>
              </div>

              <p className="text-slate-400 leading-relaxed max-w-2xl bg-white/[0.02] p-4 rounded-2xl border border-white/5 text-sm">
                {user.bio || "No bio information provided by this user."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 border-t border-[#1a1a1a] pt-12">
            {/* Wallet */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-end px-2">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest pl-1">Financial State</p>
                  <a
                      href={`https://app.infranex.it.com/profile/${user.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest border border-blue-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                  >
                      <IonIcon name="bag-handle-outline" />
                      View User Products
                  </a>
              </div>
              <button 
                  onClick={() => setShowBalanceDetails(true)}
                  className="bg-black/50 border border-white/5 p-6 rounded-3xl group hover:border-emerald-500/50 transition-all text-left w-full h-full"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                  <IonIcon name="wallet-outline" />
                </div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Available Balance</p>
                <h3 className="text-2xl font-black text-white">R {parseFloat(user.wallet_balance).toLocaleString()}</h3>
                <p className="text-[10px] text-emerald-500 mt-2 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  View Details <IonIcon name="chevron-forward" />
                </p>
              </button>
            </div>

            {/* Total Earnings */}
             <div className="bg-black/50 border border-white/5 p-6 rounded-3xl group hover:border-blue-500/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-xl mb-4">
                <IonIcon name="trending-up-outline" />
              </div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Earnings</p>
              <h3 className="text-2xl font-black text-white">R {parseFloat(totalEarnings).toLocaleString()}</h3>
            </div>

            {/* Hold Balance */}
            <div className="bg-black/50 border border-white/5 p-6 rounded-3xl group hover:border-amber-500/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl mb-4">
                <IonIcon name="stopwatch-outline" />
              </div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Hold Balance</p>
              <h3 className="text-2xl font-black text-white">R {parseFloat(user.hold_balance || '0').toLocaleString()}</h3>
            </div>
          </div>

          {/* Buttons removed: Deactivate Account, Edit User Details */}
        </div>
      </div>

      {/* Transaction History Section - Updated to match Wallet UI */}
      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2.5rem] p-8 shadow-2xl relative z-10">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Transaction History</h2>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Recent financial activities</p>
            </div>
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => setShowAllTransactions(true)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all active:scale-95 flex items-center gap-2"
                >
                    <IonIcon name="list-outline" />
                    All Transactions
                </button>
                <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-bold text-slate-400">
                    {transactions.length} Transactions
                </div>
            </div>
        </div>

        <div className="space-y-4">
            {transactions.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.02] rounded-[2.5rem] border border-dashed border-white/10">
                    <IonIcon name="receipt-outline" className="text-4xl text-slate-700 mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">No recent activity Found</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {transactions.map((tx) => {
                        const isReceived = tx.receiver_id === user.id;
                        const otherUser = isReceived ? tx.sender_username : tx.receiver_username;
                        const otherUserId = isReceived ? tx.sender_id : tx.receiver_id;
                        
                        return (
                            <div key={tx.id} className="bg-gray-800/20 border border-gray-800 rounded-2xl p-5 hover:bg-gray-800/40 transition-all group">
                                <div className="flex items-center gap-5">
                                    <div className={`w-12 h-12 ${isReceived ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'} border rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105`}>
                                        <IonIcon name={tx.type === 'request' ? 'paper-plane-outline' : (isReceived ? 'arrow-down-outline' : 'arrow-up-outline')} />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <div>
                                                <h5 className="font-bold text-white text-sm tracking-tight">
                                                    {tx.type === 'sell' ? (isReceived ? 'Sale Revenue from ' : 'Purchase for ') : (isReceived ? 'Received From ' : 'Sent To ')}
                                                    {otherUser ? (
                                                        <Link href={`/admin/users/${otherUserId}?returnTo=${pathname}&from=User_Profile`} className="text-blue-400 hover:text-blue-300 transition-colors">
                                                            @{otherUser}
                                                        </Link>
                                                    ) : 'System'}
                                                </h5>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest" suppressHydrationWarning>
                                                        {new Date(tx.created_at).toLocaleDateString('en-GB')} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
                                                    <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded bg-black/40 ${
                                                        tx.type === 'transfer' ? 'text-blue-400' : 
                                                        tx.type === 'request' ? 'text-purple-400' : 
                                                        tx.type === 'sell' ? 'text-emerald-400' : 'text-amber-400'
                                                    }`}>
                                                        {tx.type}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-base font-black tracking-tighter ${isReceived ? 'text-green-400' : 'text-red-400'}`}>
                                                    {isReceived ? '+' : '-'} R {parseFloat(tx.amount).toFixed(2)}
                                                </div>
                                                <div className={`text-[9px] uppercase font-bold tracking-widest ${tx.status === 'completed' || tx.status === 'accepted' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    {tx.status}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {(tx.description || tx.note) && (
                                            <p className="text-[11px] text-slate-400 font-medium italic mt-2 py-2 px-3 bg-black/20 rounded-lg border border-white/5">
                                                "{tx.description || tx.note}"
                                                {tx.commission_percentage && tx.commission_percentage > 0 && ` (Incl. ${tx.commission_percentage}% discount)`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </div>

      {/* Balance Details Modal */}
      {showBalanceDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#09090b] border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-white">Wallet Details</h3>
                        <p className="text-xs text-slate-400 font-medium">Breakdown of available funds</p>
                    </div>
                    <button 
                        onClick={() => setShowBalanceDetails(false)}
                        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                    >
                        <IonIcon name="close" />
                    </button>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm font-medium">Current Balance</span>
                        <span className="text-white font-black text-lg">R {parseFloat(user.wallet_balance).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm font-medium">Total Earnings</span>
                        <span className="text-emerald-400 font-black text-lg">R {parseFloat(totalEarnings).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm font-medium">On Hold</span>
                        <span className="text-amber-500 font-black text-lg">R {parseFloat(user.hold_balance || '0').toLocaleString()}</span>
                    </div>
                    
                    <div className="pt-6 border-t border-white/5 mt-6">
                        <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10">
                            <div className="flex items-start gap-3">
                                <IonIcon name="information-circle-outline" className="text-emerald-500 text-xl mt-0.5" />
                                <p className="text-[11px] text-emerald-400/80 leading-relaxed font-medium">
                                    The available balance is ready for withdrawal. Hold balance consists of funds from pending orders or security holds.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="p-8 bg-black/50 border-t border-white/5">
                    <button 
                        onClick={() => setShowBalanceDetails(false)}
                        className="w-full py-4 rounded-xl bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>
      )}
      {/* All Transactions Modal */}
      {showAllTransactions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#09090b] border border-white/10 w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h3 className="text-2xl font-black text-white tracking-tight">Full Transaction Audit</h3>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Complete history for {user.user_type?.toLowerCase() === 'admin' ? `@${user.username}` : user.full_name}</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 md:w-80">
                            <IonIcon name="search-outline" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg" />
                            <input 
                                type="text"
                                placeholder="Search by ID or Participant..."
                                value={txSearchTerm}
                                onChange={(e) => { setTxSearchTerm(e.target.value); setTxPage(1); }}
                                className="w-full bg-black border border-white/10 rounded-2xl py-3 px-12 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all"
                            />
                        </div>
                        <button 
                            onClick={() => setShowAllTransactions(false)}
                            className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors border border-white/10"
                        >
                            <IonIcon name="close" className="text-xl" />
                        </button>
                    </div>
                </div>
                
                {/* Modal Body - Scrollable Table */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {(() => {
                        const filtered = transactions.filter(tx => {
                            if (!txSearchTerm) return true;
                            const search = txSearchTerm.toLowerCase();
                            const otherUser = tx.receiver_id === user.id ? tx.sender_username : tx.receiver_username;
                            return tx.id.toString().includes(search) || 
                                   (otherUser || '').toLowerCase().includes(search);
                        });
                        
                        const totalTxPages = Math.ceil(filtered.length / txPerPage);
                        const startIndex = (txPage - 1) * txPerPage;
                        const paginated = filtered.slice(startIndex, startIndex + txPerPage);
                        
                        return (
                            <div className="space-y-6">
                                <div className="bg-black/40 rounded-3xl border border-white/5 overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/[0.02]">
                                                <th className="px-6 py-4">TX ID</th>
                                                <th className="px-6 py-4">Participant</th>
                                                <th className="px-6 py-4 text-center">Type</th>
                                                <th className="px-6 py-4 text-center">Status</th>
                                                <th className="px-6 py-4 text-right">Amount</th>
                                                <th className="px-6 py-4 text-right">Date & Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {paginated.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-20 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">No matches found</td>
                                                </tr>
                                            ) : (
                                                paginated.map((tx) => {
                                                    const isReceived = tx.receiver_id === user.id;
                                                    const otherUser = isReceived ? tx.sender_username : tx.receiver_username;
                                                    const otherUserId = isReceived ? tx.sender_id : tx.receiver_id;
                                                    
                                                    return (
                                                        <tr key={tx.id} className="hover:bg-white/[0.01] transition-colors group">
                                                            <td className="px-6 py-4 text-xs font-black text-slate-600">#{tx.id}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">{isReceived ? 'From' : 'To'}</span>
                                                                    <Link href={`/admin/users/${otherUserId}?returnTo=${pathname}&from=User_Audit`} className="text-xs font-bold text-blue-400 hover:underline">
                                                                        @{otherUser || 'System'}
                                                                    </Link>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded ${
                                                                    tx.type === 'transfer' ? 'text-blue-400 bg-blue-400/10' :
                                                                    tx.type === 'request' ? 'text-purple-400 bg-purple-400/10' :
                                                                    'text-emerald-400 bg-emerald-400/10'
                                                                }`}>
                                                                    {tx.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className={`text-[9px] uppercase font-bold ${isReceived ? 'text-green-500' : 'text-slate-400'}`}>
                                                                    {tx.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className={`text-sm font-black ${isReceived ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {isReceived ? '+' : '-'} R {parseFloat(tx.amount).toFixed(2)}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                                    {new Date(tx.created_at).toLocaleDateString()}
                                                                </div>
                                                                <div className="text-[10px] text-slate-600">
                                                                    {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Modal Pagination */}
                                {totalTxPages > 1 && (
                                    <div className="flex items-center justify-between px-2">
                                        <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                                            Page {txPage} of {totalTxPages}
                                        </p>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setTxPage(Math.max(1, txPage - 1))}
                                                disabled={txPage === 1}
                                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 transition-all"
                                            >
                                                <IonIcon name="chevron-back" />
                                            </button>
                                            <button 
                                                onClick={() => setTxPage(Math.min(totalTxPages, txPage + 1))}
                                                disabled={txPage === totalTxPages}
                                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 transition-all"
                                            >
                                                <IonIcon name="chevron-forward" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
