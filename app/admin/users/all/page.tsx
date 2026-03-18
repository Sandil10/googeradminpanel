"use client";

import { useEffect, useState } from "react";
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
}

export default function AllUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: '', full_name: '', email: '', user_type: 'User' });

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
          { id: 1, user_id: "2160", username: "test", full_name: "test user", user_type: "User", email: "test@example.com", wallet_balance: "1210.00", status: 'Active' },
          { id: 2, user_id: "9258", username: "test1", full_name: "test1 user", user_type: "Seller", email: "test1@example.com", wallet_balance: "790.50", status: 'Active' },
          { id: 3, user_id: "7800", username: "sandildilmi", full_name: "Sandil Dilmi", user_type: "User", email: "sandil@example.com", wallet_balance: "1000.00", status: 'Active' },
        ];
        setUsers(mockUsers);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const totalUserBalance = users.reduce((sum, user) => sum + parseFloat(user.wallet_balance || '0'), 0);
  const googerBalance = stats?.googer_balance || "50,000.00"; // Fallback or mock if not in stats

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (user.user_id && user.user_id.toLowerCase().includes(search)) ||
      (user.username && user.username.toLowerCase().includes(search)) ||
      (user.full_name && user.full_name.toLowerCase().includes(search)) ||
      (user.email && user.email.toLowerCase().includes(search))
    );
  });

  const handleStatusToggle = async (user: User, status: string) => {
    try {
      await adminService.updateUserStatus(user.id.toString(), status);
      setUsers(users.map(u => u.id === user.id ? { ...u, status } : u));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">User Management</h1>
          <p className="text-slate-400 text-sm font-medium">Manage and view all registered users in the ecosystem.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-white hover:bg-gray-200 text-black px-6 py-3 rounded-2xl transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest active:scale-95 shadow-lg shadow-white/10"
        >
          <IonIcon name="person-add-outline" className="text-lg" />
          Add New User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-[2rem] p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Users Balance</p>
            <h3 className="text-2xl font-black text-white">R {totalUserBalance.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
            <IonIcon name="wallet-outline" className="text-2xl text-blue-400" />
          </div>
        </div>
        <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-[2rem] p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Googer Balance</p>
            <h3 className="text-2xl font-black text-white">R {googerBalance}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <IonIcon name="business-outline" className="text-2xl text-emerald-400" />
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
             <div className="px-4 py-2 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredUsers.length} Users</span>
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
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center text-slate-500 font-medium italic">
                    {searchTerm ? `No users found matching "${searchTerm}"` : "No users registered yet."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-all group">
                    <td className="px-6 py-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 overflow-hidden shrink-0">
                          <IonIcon name="person" className="text-xl" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-white text-sm">{user.full_name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {user.user_id}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-400 font-medium tracking-tight">@{user.username}</span>
                            <span className="text-[11px] text-slate-500 italic mt-0.5">{user.email}</span>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`px-3 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                user.user_type === 'Seller' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                                user.user_type === 'Employee' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                'bg-white/5 text-slate-400 border-white/5'
                              }`}>
                                {user.user_type}
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
                        <a 
                          href={`/admin/users/${user.id}`}
                          className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:border-blue-500/30 hover:text-blue-400 transition-all flex items-center gap-2"
                        >
                          <IonIcon name="person-outline" className="text-sm" />
                          View Full Profile
                        </a>
                        <button
                          onClick={() => handleStatusToggle(user, user.status === 'Active' ? 'Deactivated' : 'Active')}
                          className={`h-10 px-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            user.status === 'Active' 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                        >
                          <IonIcon name={user.status === 'Active' ? "close-circle-outline" : "checkmark-circle-outline"} className="text-sm" />
                          {user.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
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
                  <option value="Employee">Employee / Admin</option>
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
    </div>
  );
}
