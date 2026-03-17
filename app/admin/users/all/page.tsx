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
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: '', full_name: '', email: '', user_type: 'User' });

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const data = await adminService.fetchAllUsers();
        setUsers(data || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
        
        // Fallback to mock data if API fails (for demo purposes)
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

    loadUsers();
  }, []);

  const handleStatusToggle = async (user: User) => {
    try {
      const newStatus = user.status === 'Active' ? 'Deactivated' : 'Active';
      await adminService.updateUserStatus(user.id.toString(), newStatus);
      setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      setActiveMenu(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">All Users</h1>
          <p className="text-slate-400">Manage and view all registered users.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-bold"
        >
          <IonIcon name="person-add-outline" />
          Add New User
        </button>
      </div>

      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-xl min-h-[700px] relative overflow-visible">
        <div className="w-full">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#1a1a1a] text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">User ID</th>
                <th className="px-6 py-4 font-semibold">Username</th>
                <th className="px-6 py-4 font-semibold">Full Name</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Balance</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/30 transition-colors text-sm">
                  <td className="px-6 py-4 text-slate-500 font-mono">#{user.id}</td>
                  <td className="px-6 py-4 text-white font-bold">{user.user_id}</td>
                  <td className="px-6 py-4 text-slate-400">@{user.username}</td>
                  <td className="px-6 py-4">
                    <a href={`/admin/users/${user.id}`} className="text-white hover:underline font-medium">
                      {user.full_name}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${user.user_type === 'seller' ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-400'
                      }`}>
                      {user.user_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-white">R {user.wallet_balance}</td>
                  <td className={`px-6 py-4 text-right relative ${activeMenu === user.id ? 'z-[50]' : ''}`}>
                    <button
                      onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                      className={`p-2 hover:bg-[#1a1a1a] rounded-xl transition-all ${activeMenu === user.id ? 'text-white bg-[#1a1a1a]' : 'text-slate-500'}`}
                    >
                      <IonIcon name="ellipsis-vertical" className="text-lg" />
                    </button>

                    {activeMenu === user.id && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setActiveMenu(null)}></div>
                        <div className="absolute right-12 top-0 w-60 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] z-[70] py-4 animate-in fade-in zoom-in-95 duration-200 text-left overflow-hidden">
                          <p className="px-5 py-2 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] border-b border-white/5 mb-2 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                            User Settings
                          </p>
                          
                          <a
                            href={`/admin/users/${user.id}`}
                            className="flex items-center gap-3 px-5 py-3 text-xs text-white hover:bg-white/5 transition-colors"
                          >
                            <IonIcon name="person-outline" className="text-lg text-slate-400" />
                            View Full Profile
                          </a>

                          <div className="h-px bg-white/5 my-2 mx-5"></div>

                          <button
                            onClick={() => handleStatusToggle(user)}
                            className={`w-full flex items-center gap-3 px-5 py-3 text-xs transition-colors ${user.status === 'Active' ? 'text-rose-400 hover:bg-rose-400/10' : 'text-emerald-400 hover:bg-emerald-400/10'
                              }`}
                          >
                            <IonIcon name={user.status === 'Active' ? "close-circle-outline" : "checkmark-circle-outline"} className="text-lg" />
                            {user.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                          </button>

                          <button 
                            onClick={() => { alert("Edit form functionality would go here"); setActiveMenu(null); }}
                            className="w-full flex items-center gap-3 px-5 py-3 text-xs text-white hover:bg-white/5 transition-colors"
                          >
                            <IonIcon name="create-outline" className="text-lg text-slate-400" />
                            Edit User Details
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
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
