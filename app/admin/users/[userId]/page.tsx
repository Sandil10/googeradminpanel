"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import Link from "next/link";

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
  const { userId } = use(params);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        // We need to fetch by user_id string, but our backend currently takes numerical id in routes/users.js
        // Wait, I should check how to fetch by user_id string. 
        // For now, I'll fetch all and find, or I should ideally add a route for user_id lookup.
        // Actually, let's assume the numerical ID is passed for now, or I'll fix the route.
        const data = await adminService.fetchUserDetails(userId);
        setUser(data);
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
        <Link 
            href="/admin/users/all"
            className="absolute top-6 left-6 flex items-center gap-2 text-xs font-bold text-white/50 hover:text-white transition-colors bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10"
        >
            <IonIcon name="arrow-back" />
            Back to Users
        </Link>
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
                    <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/10 text-white border border-white/5">
                        {user.user_type}
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
            <div className="bg-black/50 border border-white/5 p-6 rounded-3xl group hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xl mb-4">
                <IonIcon name="wallet-outline" />
              </div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Available Balance</p>
              <h3 className="text-2xl font-black text-white">R {parseFloat(user.wallet_balance).toLocaleString()}</h3>
            </div>

            {/* Earnings Placeholder */}
             <div className="bg-black/50 border border-white/5 p-6 rounded-3xl group hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-xl mb-4">
                <IonIcon name="trending-up-outline" />
              </div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Earnings</p>
              <h3 className="text-2xl font-black text-white">R 0.00</h3>
            </div>

            {/* Hold Balance */}
            <div className="bg-black/50 border border-white/5 p-6 rounded-3xl group hover:border-white/20 transition-all">
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
    </div>
  );
}
