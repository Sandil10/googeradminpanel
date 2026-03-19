"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const { userId } = use(params);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalEarnings, setTotalEarnings] = useState("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBalanceDetails, setShowBalanceDetails] = useState(false);

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
    ? (user.profile_picture.startsWith('http') ? user.profile_picture : `/uploads/${user.profile_picture}`)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&size=200&background=random`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header / Cover */}
      <div className="relative h-48 bg-[#1a1a1a] rounded-3xl overflow-hidden border border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-transparent to-blue-600/20"></div>
        <button 
            onClick={() => router.back()}
            className="absolute top-6 left-6 flex items-center gap-2 text-xs font-bold text-white/50 hover:text-white transition-colors bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 active:scale-95"
        >
            <IonIcon name="arrow-back" />
            Go Back
        </button>
      </div>

      {/* Main Stats Card */}
      <div className="relative px-8">
        <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2.5rem] p-8 -mt-24 shadow-2xl relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar */}
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-8 border-[#09090b] shadow-2xl bg-slate-800 shrink-0">
              <Image
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
                  <h1 className="text-3xl font-black text-white tracking-tight">{user.full_name}</h1>
                  <p className="text-slate-400 font-medium">@{user.username} • User ID: {user.user_id}</p>
                </div>
                <div className="flex gap-2">
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
            <button 
                onClick={() => setShowBalanceDetails(true)}
                className="bg-black/50 border border-white/5 p-6 rounded-3xl group hover:border-emerald-500/50 transition-all text-left"
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

          <div className="flex justify-end gap-3 mt-12">
             <button 
                onClick={handleStatusToggle}
                className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                    user.status === 'Active' 
                    ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20' 
                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
                }`}
             >
                <IonIcon name={user.status === 'Active' ? "close-circle" : "checkmark-circle"} />
                {user.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
             </button>
             <button className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-white text-black hover:bg-gray-200 transition-all">
                Edit User Details
             </button>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2.5rem] p-8 shadow-2xl relative z-10">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Transaction History</h2>
                <p className="text-slate-500 text-xs font-medium">Recent financial activities for this user</p>
            </div>
            <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-bold text-slate-400">
                {transactions.length} Transactions
            </div>
        </div>

        <div className="space-y-4">
            {transactions.length === 0 ? (
                <div className="text-center py-12 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                    <IonIcon name="receipt-outline" className="text-4xl text-slate-600 mb-4" />
                    <p className="text-slate-500 font-medium">No transactions found</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <th className="px-6 py-4">Transaction Details</th>
                                <th className="px-6 py-4">From / To</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx) => {
                                const isReceiver = tx.receiver_id === user.id;
                                const counterparty = isReceiver ? (tx.sender_full_name || 'System') : (tx.receiver_full_name || 'System');
                                const counterpartyId = isReceiver ? tx.sender_readable_id : tx.receiver_readable_id;
                                
                                return (
                                    <tr key={tx.id} className="bg-white/[0.02] hover:bg-white/[0.05] transition-colors group">
                                        <td className="px-6 py-4 rounded-l-2xl border-l border-t border-b border-white/5">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                                                    isReceiver ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                                }`}>
                                                    <IonIcon name={isReceiver ? "arrow-down" : "arrow-up"} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white uppercase tracking-tight">
                                                        {tx.type === 'sell' ? 'Product Sale' : tx.type === 'transfer' ? 'Wallet Transfer' : 'Transaction'}
                                                    </p>
                                                    {tx.description && (
                                                        <p className="text-[10px] text-slate-400 font-medium italic mt-0.5">
                                                            {tx.description}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-slate-500">
                                                        {new Date(tx.created_at).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 border-t border-b border-white/5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-white uppercase tracking-tight">
                                                    {counterparty}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    ID: {counterpartyId || 'N/A'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center border-t border-b border-white/5">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                                                tx.status === 'accepted' || tx.status === 'completed' 
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                : tx.status === 'pending'
                                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                            }`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right rounded-r-2xl border-r border-t border-b border-white/5">
                                            <p className={`text-sm font-black ${isReceiver ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {isReceiver ? '+' : '-'} R {parseFloat(tx.amount).toLocaleString()}
                                            </p>
                                            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">
                                                {tx.payment_method}
                                            </p>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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
    </div>
  );
}
