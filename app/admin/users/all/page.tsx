"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import IonIcon from "../../../components/IonIcon";
import { adminService } from "../../../services/adminService";

interface User {
  id: number;
  user_id: string;
  username: string;
  full_name: string;
  user_type: string;
  email: string;
  wallet_balance: string;
  status: string;
  created_at: string;
}

interface UsersTableProps {
  userTypeFilter?: 'User' | 'Seller' | 'Employee';
}

export default function AllUsersPage({ userTypeFilter }: UsersTableProps) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: '', full_name: '', email: '', user_type: 'User' });
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("highest");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [confirmStatusModal, setConfirmStatusModal] = useState<{ user: User, nextStatus: string } | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  
  const [showGoogerTransferModal, setShowGoogerTransferModal] = useState(false);
  const [transferTargetAdmin, setTransferTargetAdmin] = useState<number | null>(null);
  const [googerTransferAmount, setGoogerTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [usersData, statsData] = await Promise.all([
          adminService.fetchAllUsers(),
          adminService.fetchStats().catch(() => null)
        ]);
        setUsers(usersData || []);
        setStats(statsData);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
        
        // Fallback to mock data if API fails
        const mockUsers: User[] = [
          { id: 1, user_id: "2160", username: "test", full_name: "test user", user_type: "User", email: "test@example.com", wallet_balance: "1210.00", status: 'Active', created_at: new Date().toISOString() },
          { id: 2, user_id: "9258", username: "test1", full_name: "test1 user", user_type: "Seller", email: "test1@example.com", wallet_balance: "790.50", status: 'Active', created_at: new Date().toISOString() },
          { id: 3, user_id: "7800", username: "sandildilmi", full_name: "Sandil Dilmi", user_type: "User", email: "sandil@example.com", wallet_balance: "1000.00", status: 'Active', created_at: new Date().toISOString() },
        ];
        setUsers(mockUsers);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [userTypeFilter]);

  const typeFilteredUsers = userTypeFilter 
    ? users.filter(user => user.user_type && user.user_type.toLowerCase() === userTypeFilter.toLowerCase())
    : users;

  const totalUserBalance = typeFilteredUsers.reduce((sum, user) => sum + parseFloat(user.wallet_balance || '0'), 0);
  
  const displayBalance = stats?.googerBalance || "0.00";
  const adminUsers = users.filter(u => u.user_type?.toLowerCase() === 'admin' || u.user_type?.toLowerCase() === 'super_admin');

  const filteredUsers = typeFilteredUsers.filter(user => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (user.user_id && user.user_id.toLowerCase().includes(search)) ||
      (user.username && user.username.toLowerCase().includes(search)) ||
      (user.full_name && user.full_name.toLowerCase().includes(search)) ||
      (user.email && user.email.toLowerCase().includes(search))
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === "highest") return parseFloat(b.wallet_balance || '0') - parseFloat(a.wallet_balance || '0');
    if (sortBy === "lowest") return parseFloat(a.wallet_balance || '0') - parseFloat(b.wallet_balance || '0');
    return 0;
  });

  const handleStatusToggle = async () => {
    if (!confirmStatusModal) return;
    const { user, nextStatus } = confirmStatusModal;
    try {
      setLoading(true);
      await adminService.updateUserStatus(user.id.toString(), nextStatus);
      setUsers(users.map(u => u.id === user.id ? { ...u, status: nextStatus } : u));
      setConfirmStatusModal(null);
      if (nextStatus === 'Deactivated') {
        router.push('/admin/users/deactivated');
      }
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      setLoading(true);
      await adminService.softDeleteUser(deleteConfirmUser.id.toString());
      setUsers(users.filter(u => u.id !== deleteConfirmUser.id));
      setDeleteConfirmUser(null);
    } catch (err: any) {
      alert("Error deleting user: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogerTransfer = async () => {
    if (!transferTargetAdmin || !googerTransferAmount || isNaN(Number(googerTransferAmount)) || Number(googerTransferAmount) <= 0) {
      alert("Please select an admin and enter a valid amount.");
      return;
    }
    
    try {
      setTransferLoading(true);
      await adminService.transferGoogerToAdmin(transferTargetAdmin, Number(googerTransferAmount));
      alert("Transfer successful!");
      setShowGoogerTransferModal(false);
      setTransferTargetAdmin(null);
      setGoogerTransferAmount('');
      
      // Refresh strictly the users and stats context
      const [usersData, statsData] = await Promise.all([
        adminService.fetchAllUsers(),
        adminService.fetchStats().catch(() => null)
      ]);
      setUsers(usersData || []);
      setStats(statsData);
      
    } catch (err: any) {
      alert("Transfer failed: " + err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
            {userTypeFilter ? `${userTypeFilter}s Management` : "All Users Management"}
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            {userTypeFilter 
              ? `Manage and view all registered ${userTypeFilter.toLowerCase()}s in the ecosystem.`
              : "Manage and view all registered users in the ecosystem."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="h-12 bg-white hover:bg-gray-200 text-black px-6 py-3 rounded-2xl transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-lg shadow-white/10"
          >
            <IonIcon name="person-add-outline" className="text-lg" />
            Add New User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-[2rem] p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
              Total {userTypeFilter ? `${userTypeFilter}s` : "Users"} Balance
            </p>
            <h3 className="text-2xl font-black text-white">R {totalUserBalance.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
            <IonIcon name="wallet-outline" className="text-2xl text-blue-400" />
          </div>
        </div>
        <div 
          onClick={() => setShowGoogerTransferModal(true)}
          className="bg-emerald-600/10 border border-emerald-500/20 rounded-[2rem] p-6 flex flex-1 items-center justify-between cursor-pointer hover:bg-emerald-600/20 hover:border-emerald-500/40 transition-all active:scale-[0.98] group relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10 w-full flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 group-hover:text-emerald-300 transition-colors">
                Googer Balance
              </p>
              <h3 className="text-2xl font-black text-white">R {displayBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 group-hover:rotate-12 transition-transform duration-300">
              <IonIcon name="business-outline" className="text-2xl text-emerald-400 group-hover:text-emerald-300" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] relative min-h-[500px] shadow-2xl overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-[2rem]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
          </div>
        )}

        <div className="p-6 border-b border-[#1a1a1a] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
              <IonIcon name="search-outline" className="text-lg" />
            </div>
            <input
              type="text"
              placeholder="Search User ID, Name, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
             <div className="relative">
                <button 
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    className="h-11 px-4 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-500/30 transition-all flex items-center gap-2"
                >
                    <IonIcon name="swap-vertical-outline" className="text-sm" />
                    {sortBy === 'highest' ? 'All Users' : sortBy === 'newest' ? 'New Users' : sortBy === 'oldest' ? 'Oldest Users' : 'Lowest Balance'}
                </button>
                
                {isSortOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsSortOpen(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-56 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl z-[70] py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-4 py-2 border-b border-white/5 mb-1">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Grouping</p>
                            </div>
                            <button 
                                onClick={() => { setSortBy("highest"); setIsSortOpen(false); }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'highest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <IonIcon name="people-outline" /> All Users
                            </button>
                            <button 
                                onClick={() => { setSortBy("newest"); setIsSortOpen(false); }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'newest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <IonIcon name="sparkles-outline" /> New Users
                            </button>
                            
                            <div className="px-4 py-2 border-b border-t border-white/5 my-1">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sorting</p>
                            </div>
                            <button 
                                onClick={() => { setSortBy("highest"); setIsSortOpen(false); }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'highest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <IonIcon name="trending-up-outline" /> Highest Balance
                            </button>
                            <button 
                                onClick={() => { setSortBy("lowest"); setIsSortOpen(false); }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'lowest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <IonIcon name="trending-down-outline" /> Lowest Balance
                            </button>
                            <button 
                                onClick={() => { setSortBy("oldest"); setIsSortOpen(false); }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'oldest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <IonIcon name="hourglass-outline" /> Oldest Users
                            </button>
                        </div>
                    </>
                )}
            </div>
             <div className="px-4 py-2 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sortedUsers.length} Users</span>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#1a1a1a]/50 text-slate-300 text-[9px] font-black uppercase tracking-[0.2em]">
                <th className="px-6 py-5">User Information</th>
                <th className="px-6 py-5 text-center">Wallet Balance</th>
                <th className="px-6 py-5 text-right w-[400px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center text-slate-500 font-medium italic">
                    {searchTerm ? `No users found matching "${searchTerm}"` : "No users registered yet."}
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-all group">
                    <td className="px-6 py-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 overflow-hidden shrink-0">
                          <IonIcon name="person" className="text-xl" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link 
                              href={`/admin/users/${user.id}`}
                              className="font-bold text-white text-sm hover:text-blue-400 transition-colors"
                            >
                              {user.full_name}
                            </Link>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {user.user_id}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Link href={`/admin/users/${user.id}`} className="text-xs text-slate-400 font-medium tracking-tight hover:text-blue-400 transition-colors">@{user.username}</Link>
                            <span className="text-[11px] text-slate-500 italic mt-0.5">{user.email}</span>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`px-3 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                user.user_type?.toLowerCase() === 'admin' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                                user.user_type?.toLowerCase() === 'seller' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                                user.user_type?.toLowerCase() === 'employee' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                'bg-white/5 text-slate-400 border-white/5'
                              }`}>
                                {user.user_type?.toLowerCase() === 'admin' ? 'Admin' : 
                                 user.user_type?.toLowerCase() === 'seller' ? 'Seller' :
                                 user.user_type?.toLowerCase() === 'employee' ? 'Employee' : 'User'}
                              </span>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{user.status}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-black text-white">R {parseFloat(user.wallet_balance || '0').toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link 
                          href={`/admin/users/${user.id}`}
                          className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[8px] font-black uppercase tracking-widest hover:border-blue-500/30 hover:text-blue-400 transition-all flex items-center gap-2"
                        >
                          <IonIcon name="person-outline" className="text-sm" />
                          View Full Profile
                        </Link>
                        <button
                          onClick={() => setConfirmStatusModal({ user, nextStatus: user.status === 'Active' ? 'Deactivated' : 'Active' })}
                          className={`h-10 px-4 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            user.status === 'Active' 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                        >
                          <IonIcon name={user.status === 'Active' ? "close-circle-outline" : "checkmark-circle-outline"} className="text-sm" />
                          {user.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmUser(user)}
                          className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-500 text-[8px] font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all flex items-center gap-2"
                        >
                          <IonIcon name="trash-outline" className="text-sm" />
                          Delete Account
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] w-full max-w-md p-8 relative z-[110] shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white uppercase tracking-wider">Add New User</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <IonIcon name="close" size="large" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Full Name</label>
                <input 
                  type="text" 
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-white focus:border-white/50 outline-none transition-all"
                  placeholder="Enter full name"
                  value={newUserData.full_name}
                  onChange={e => setNewUserData({...newUserData, full_name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Username</label>
                <input 
                  type="text" 
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-white focus:border-white/50 outline-none transition-all"
                  placeholder="Enter username"
                  value={newUserData.username}
                  onChange={e => setNewUserData({...newUserData, username: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Email Address</label>
                <input 
                  type="email" 
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-white focus:border-white/50 outline-none transition-all"
                  placeholder="name@example.com"
                  value={newUserData.email}
                  onChange={e => setNewUserData({...newUserData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">User Type</label>
                <select 
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-white focus:border-white/50 outline-none transition-all appearance-none"
                  value={newUserData.user_type}
                  onChange={e => setNewUserData({...newUserData, user_type: e.target.value})}
                >
                  <option value="User">Standard User</option>
                  <option value="Seller">Seller / Merchant</option>
                  <option value="Employee">Employee</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              
              <button 
                onClick={() => { alert("User added (Demo)"); setShowAddModal(false); }}
                className="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl mt-4 hover:bg-gray-200 transition-all active:scale-95"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Activation/Deactivation Confirmation Modal */}
      {confirmStatusModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300" 
            onClick={() => setConfirmStatusModal(null)}
          ></div>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] w-full max-w-sm p-8 relative z-[210] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
            {/* Background design elements */}
            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 opacity-20 ${confirmStatusModal.nextStatus === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            
            <div className={`w-16 h-16 rounded-2xl mb-6 flex items-center justify-center border animate-bounce ${
              confirmStatusModal.nextStatus === 'Active' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              <IonIcon name={confirmStatusModal.nextStatus === 'Active' ? "shield-checkmark-outline" : "alert-circle-outline"} className="text-3xl" />
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
              Confirm Account {confirmStatusModal.nextStatus === 'Active' ? 'Activation' : 'Deactivation'}
            </h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
              Are you sure you want to <span className={confirmStatusModal.nextStatus === 'Active' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {confirmStatusModal.nextStatus.toLowerCase()}
              </span> the account for <span className="text-white font-bold">{confirmStatusModal.user.full_name}</span>? This action will affect their access to the system.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setConfirmStatusModal(null)}
                className="h-12 rounded-xl bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button 
                onClick={handleStatusToggle}
                className={`h-12 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
                  confirmStatusModal.nextStatus === 'Active'
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20'
                  : 'bg-rose-500 text-white hover:bg-rose-400 shadow-rose-500/20'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300" 
            onClick={() => setDeleteConfirmUser(null)}
          ></div>
          <div className="bg-[#0c0c0e] border border-rose-500/20 rounded-[2.5rem] w-full max-w-sm p-8 relative z-[210] shadow-[0_50px_100px_-20px_rgba(255,0,0,0.1)] animate-in fade-in zoom-in-95 duration-300 overflow-hidden text-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-rose-500/10 blur-3xl -mt-16 opacity-30"></div>
            
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-500 animate-pulse">
              <IonIcon name="trash-outline" className="text-4xl" />
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-3">Delete User Account?</h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
              Are you sure you want to delete <span className="text-white font-bold">{deleteConfirmUser.full_name}</span>'s account? 
              <br/><br/>
              The user will be moved to the <span className="text-rose-400 font-bold">Deactivated Users</span> list and permanently deleted after <span className="text-white font-bold">7 days</span>.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteUser}
                className="h-14 rounded-2xl bg-rose-500 text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-400 transition-all active:scale-95 shadow-lg shadow-rose-500/20"
              >
                Move to Deactivated
              </button>
              <button 
                onClick={() => setDeleteConfirmUser(null)}
                className="h-12 rounded-2xl bg-white/5 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-95"
              >
                Keep Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Googer Balance Transfer Modal */}
      {showGoogerTransferModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowGoogerTransferModal(false)}></div>
          <div className="bg-[#09090b] border border-emerald-500/20 rounded-[2rem] w-full max-w-md p-8 relative z-[310] shadow-2xl shadow-emerald-900/20 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <IonIcon name="business-outline" className="text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wider leading-tight">Googer Transfer</h3>
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-1">Available: R {parseFloat(displayBalance || '0').toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGoogerTransferModal(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <IonIcon name="close" size="large" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Select Admin Target</label>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {adminUsers.length === 0 ? (
                    <div className="p-4 border border-dashed border-white/10 rounded-xl text-center">
                      <p className="text-xs text-slate-500 italic">No admin users found.</p>
                      <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-widest">You need at least 1 Admin to transfer funds.</p>
                    </div>
                  ) : (
                    adminUsers.map(admin => (
                      <div 
                        key={admin.id}
                        onClick={() => setTransferTargetAdmin(admin.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          transferTargetAdmin === admin.id 
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                          : 'bg-[#0c0c0e] border-[#1a1a1a] text-slate-400 hover:border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-bold ${transferTargetAdmin === admin.id ? 'text-white' : 'text-slate-300'}`}>{admin.full_name}</p>
                          <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${transferTargetAdmin === admin.id ? 'text-emerald-500' : 'text-slate-600'}`}>{admin.user_type}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-[10px] font-mono mb-1 ${transferTargetAdmin === admin.id ? 'text-emerald-400/70' : 'text-slate-600'}`}>ID: {admin.user_id}</p>
                          <p className={`text-[10px] font-bold ${transferTargetAdmin === admin.id ? 'text-emerald-400' : 'text-slate-500'}`}>
                            Balance <span className="text-white ml-2 block mt-1">R {parseFloat(admin.wallet_balance || '0').toLocaleString()}</span>
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="pt-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Transfer Amount</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold whitespace-nowrap">R</div>
                  <input 
                    type="number" 
                    className="w-full bg-[#0c0c0e] border border-[#1a1a1a] rounded-xl pl-10 pr-16 py-4 text-white font-bold text-lg focus:border-emerald-500/50 outline-none transition-all font-mono placeholder:text-slate-700"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={googerTransferAmount}
                    onChange={e => setGoogerTransferAmount(e.target.value)}
                  />
                  <button 
                    onClick={() => setGoogerTransferAmount(displayBalance.toString())}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-white hover:bg-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>
              
              <button 
                onClick={handleGoogerTransfer}
                disabled={transferLoading || !transferTargetAdmin || !googerTransferAmount || Number(googerTransferAmount) <= 0}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/30 disabled:text-emerald-400/50 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl mt-4 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3"
              >
                {transferLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing Transfer...
                  </>
                ) : (
                  <>
                    <IonIcon name="send-outline" className="text-lg" />
                    Complete Transfer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
