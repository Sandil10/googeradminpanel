"use client";

import React, { useState, useEffect } from 'react';
import { adminService } from '../../../services/adminService';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import IonIcon from "@/components/IonIcon";

interface User {
  id: number;
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  user_type: string;
  status: string;
  wallet_balance: string;
  created_at: string;
  marked_for_deletion_at: string;
}

export default function DeactivatedUsersPage() {
  const pathname = usePathname();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [restoreConfirmUser, setRestoreConfirmUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  useEffect(() => {
    fetchDeactivated();
  }, []);

  const fetchDeactivated = async () => {
    try {
      setLoading(true);
      const data = await adminService.fetchDeactivatedUsers();
      setUsers(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreConfirmUser) return;
    try {
      setLoading(true);
      await adminService.restoreUser(restoreConfirmUser.id.toString());
      setUsers(users.filter(u => u.id !== restoreConfirmUser.id));
      setRestoreConfirmUser(null);
    } catch (err: any) {
      alert("Error restoring user: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmUser) return;
    try {
      setLoading(true);
      await adminService.permanentlyDeleteUser(deleteConfirmUser.id.toString());
      setUsers(users.filter(u => u.id !== deleteConfirmUser.id));
      setDeleteConfirmUser(null);
    } catch (err: any) {
      alert("Error deleting user: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDeletionDate = (markedDate: string) => {
    const date = new Date(markedDate);
    date.setDate(date.getDate() + 7);
    return date;
  };

  const getDaysRemaining = (markedDate: string | null) => {
    if (!markedDate) return null;
    const deletionDate = calculateDeletionDate(markedDate);
    const now = new Date();
    const diff = deletionDate.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const filteredUsers = users.filter((user) => {
    const search = searchTerm.toLowerCase();
    return (
      (user.user_id && user.user_id.toLowerCase().includes(search)) ||
      (user.username && user.username.toLowerCase().includes(search)) ||
      (user.full_name && user.full_name.toLowerCase().includes(search)) ||
      (user.email && user.email.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Deactivated Users</h1>
          <p className="text-slate-400 text-sm font-medium">
            Users marked for deletion are kept here for 7 days before permanent removal.
          </p>
        </div>
      </div>

      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] shadow-2xl overflow-hidden min-h-[400px]">
        {loading && (
          <div className="p-20 text-center">
             <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white mx-auto"></div>
             <p className="text-slate-500 text-xs mt-4 uppercase tracking-widest font-black">Loading deactivated accounts...</p>
          </div>
        )}

        {!loading && (
          <>
            <div className="p-6 border-b border-[#1a1a1a]">
              <div className="relative max-w-md">
                <IonIcon name="search-outline" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search deactivated users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs text-white focus:outline-none focus:border-blue-500/30 transition-all"
                />
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#1a1a1a]/50 text-slate-300 text-[8px] font-black uppercase tracking-[0.2em]">
                    <th className="px-6 py-5">User</th>
                    <th className="px-6 py-5 text-center">Deactivation Date</th>
                    <th className="px-6 py-5 text-center">Status / Deletion</th>
                    <th className="px-6 py-5 text-right font-black">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={4} className="py-20 text-center text-slate-500 font-medium italic">No deactivated users found.</td></tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                              <IonIcon name="person-remove" />
                            </div>
                            <div>
                              <Link href={`/admin/users/${user.id}?returnTo=${pathname}&from=Deactivated`} className="font-bold text-white text-sm hover:text-blue-400 transition-colors block">
                                {user.full_name}
                              </Link>
                              <Link href={`/admin/users/${user.id}?returnTo=${pathname}&from=Deactivated`} className="text-xs text-slate-500 italic hover:text-blue-400 transition-colors block">
                                @{user.username}
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center text-[10px] text-slate-400 font-medium">
                          {user.marked_for_deletion_at ? new Date(user.marked_for_deletion_at).toLocaleDateString() : 'Manual Deactivation'}
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${user.marked_for_deletion_at ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.marked_for_deletion_at ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`}></span>
                            <span className={`text-[8px] font-black uppercase tracking-widest ${user.marked_for_deletion_at ? 'text-rose-400' : 'text-amber-400'}`}>
                              {user.marked_for_deletion_at ? `${getDaysRemaining(user.marked_for_deletion_at)} Days Left` : 'Manually Deactivated'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button 
                              onClick={() => setRestoreConfirmUser(user)}
                              className="h-10 px-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-black uppercase tracking-widest hover:bg-blue-500/20 hover:border-blue-500/40 transition-all flex items-center gap-2 active:scale-95"
                            >
                              <IonIcon name="refresh-outline" className="text-sm" />
                              Restore Account
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmUser(user)}
                              className="h-10 px-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-widest hover:bg-rose-500/20 hover:border-rose-500/40 transition-all flex items-center gap-2 active:scale-95"
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
          </>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {restoreConfirmUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300" 
            onClick={() => setRestoreConfirmUser(null)}
          ></div>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] w-full max-w-sm p-8 relative z-[210] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-300 overflow-hidden text-center">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 opacity-20 bg-blue-500"></div>
            
            <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center border animate-bounce bg-blue-500/10 border-blue-500/20 text-blue-400">
              <IonIcon name="refresh-outline" className="text-3xl" />
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
              Restore User?
            </h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
              Are you sure you want to restore the account for <span className="text-white font-bold">{restoreConfirmUser.full_name}</span>?
              <br/><br/>
              This will safely reactivate their account and stop the <span className="text-blue-400 font-bold">7-day</span> deletion process.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setRestoreConfirmUser(null)}
                className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-95"
              >
                Cancel
              </button>
              <button 
                onClick={handleRestore}
                className="flex-1 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20 shadow-lg border border-blue-500/40"
              >
                Confirm Restore
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
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 opacity-20 bg-rose-500"></div>
            
            <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center border animate-bounce bg-rose-500/10 border-rose-500/20 text-rose-400">
              <IonIcon name="warning-outline" className="text-4xl" />
            </div>

            <h3 className="text-xl font-black text-rose-500 uppercase tracking-tight mb-2">
              Permanently Delete?
            </h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
              Are you sure you want to permanently delete <span className="text-white font-bold">{deleteConfirmUser.full_name}</span>?
              <br/><br/>
              This action <span className="text-rose-400 font-bold">cannot be undone</span>. All their data, transactions, and information will be completely erased from the database immediately.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDelete}
                className="w-full h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-lg shadow-rose-500/10"
              >
                Permanently Delete
              </button>
              <button 
                onClick={() => setDeleteConfirmUser(null)}
                className="w-full h-12 rounded-2xl bg-white/5 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-95"
              >
                Cancel Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
