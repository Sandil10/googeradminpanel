"use client";

import { useEffect, useMemo, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

interface DeletedUser {
  id: number;
  user_id: string | null;
  username: string | null;
  email: string | null;
  phone_number: string | null;
  self_deleted_at: string | null;
  permanent_deactivated_at: string | null;
  status: string | null;
}

export default function DeletedUsersPage() {
  const [users, setUsers] = useState<DeletedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await adminService.fetchDeletedUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const restoreUser = async (user: DeletedUser) => {
    if (!user.self_deleted_at) return;
    try {
      setActionBusyId(user.id);
      await adminService.restoreUser(String(user.id));
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
    } catch (error: any) {
      alert(error?.message || "Failed to restore account");
    } finally {
      setActionBusyId(null);
    }
  };

  const permanentlyDeleteUser = async (user: DeletedUser) => {
    if (!user.self_deleted_at) return;
    const confirmed = window.confirm(`Permanently delete ${user.username || user.email || "this account"}? This final admin action cannot be undone.`);
    if (!confirmed) return;
    try {
      setActionBusyId(user.id);
      await adminService.permanentlyDeleteUser(String(user.id));
      await load();
    } catch (error: any) {
      alert(error?.message || "Failed to permanently delete account");
    } finally {
      setActionBusyId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return users;
    return users.filter((user) => (
      String(user.username || "").toLowerCase().includes(search) ||
      String(user.user_id || "").toLowerCase().includes(search) ||
      String(user.email || "").toLowerCase().includes(search) ||
      String(user.phone_number || "").toLowerCase().includes(search)
    ));
  }, [searchTerm, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-white">Deleted Users</h1>
        <p className="text-sm font-medium text-slate-400">
          Permanently deleted accounts keep only blocking details for future signup checks.
        </p>
      </div>

      <div className="min-h-[400px] overflow-hidden rounded-[2rem] border border-[#1a1a1a] bg-[#09090b] shadow-2xl">
        <div className="border-b border-[#1a1a1a] p-6">
          <div className="relative max-w-md">
            <IonIcon name="search-outline" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search deleted users..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-2xl border border-white/5 bg-[#0c0c0e] py-3 pl-12 pr-4 text-xs text-white outline-none transition-all focus:border-rose-500/30"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-20 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-t-2 border-white" />
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-500">Loading deleted users...</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#1a1a1a]/50 text-[8px] font-black uppercase tracking-[0.2em] text-slate-300">
                  <th className="px-6 py-5">Deleted User</th>
                  <th className="px-6 py-5">User ID</th>
                  <th className="px-6 py-5">Email</th>
                  <th className="px-6 py-5">Phone Number</th>
                  <th className="px-6 py-5 text-center">Deleted Date</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-sm font-medium italic text-slate-500">
                      No deleted users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
                            <IonIcon name="trash-outline" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-white">{user.username || `deleted_user_${user.id}`}</p>
                            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-rose-300">
                              {user.self_deleted_at ? "User Deleted" : user.status || "Permanently Deactivated"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-xs font-mono text-slate-300">{user.user_id || "-"}</td>
                      <td className="px-6 py-6 text-xs font-bold text-slate-300">{user.email || "-"}</td>
                      <td className="px-6 py-6 text-xs font-bold text-slate-300">{user.phone_number || "-"}</td>
                      <td className="px-6 py-6 text-center text-[10px] font-bold text-slate-500">
                        {(user.self_deleted_at || user.permanent_deactivated_at) ? new Date(user.self_deleted_at || user.permanent_deactivated_at || "").toLocaleString() : "-"}
                      </td>
                      <td className="px-6 py-6 text-right">
                        {user.self_deleted_at ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => restoreUser(user)}
                              disabled={actionBusyId === user.id}
                              className="h-10 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-[8px] font-black uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => permanentlyDeleteUser(user)}
                              disabled={actionBusyId === user.id}
                              className="h-10 rounded-xl border border-red-500/25 bg-red-500/10 px-3 text-[8px] font-black uppercase tracking-widest text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                            >
                              Permanently Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-widest text-white/25">Final</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
