"use client";

import { useEffect, useMemo, useState } from "react";
import IonIcon from "../../components/IonIcon";
import { adminService } from "../../services/adminService";

type PostRow = {
  id: number;
  user_id: number;
  text: string | null;
  text_color: string | null;
  likes_count: number;
  comments_count: number;
  views_count: number;
  shares_count: number;
  created_at: string;
  updated_at: string;
  share_code: string | null;
  username: string | null;
  full_name: string | null;
  user_type: string | null;
  googer_user_id: string | null;
  email: string | null;
  profile_picture: string | null;
  is_active: boolean;
  is_deactivated?: boolean;
  self_deactivated_at?: string | null;
  suspended_wallet_access?: boolean;
  wallet_balance?: string | number | null;
  suspension_reason_category?: string | null;
  appeal_status?: string | null;
};

const POSTS_PER_PAGE = 20;
const SUSPENSION_REASONS = [
  "Spam Activity",
  "Fake Account / Impersonation",
  "Harassment or Bullying",
  "Hate Speech",
  "Inappropriate Content",
  "Copyright Violation",
  "Fraud / Scam Activity",
  "Other (Custom Reason)",
];

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} MIN`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} H`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} D`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} MO`;
  return `${Math.floor(mo / 12)} Y`;
}

function normalizeProfilePicture(value?: string | null) {
  if (!value) return "";
  if (value.startsWith("http") || value.startsWith("data:") || value.startsWith("/")) return value;
  return `/uploads/${value.split(/[\\/]/).pop()}`;
}

function getPostUserDisplayName(post: PostRow) {
  const normalizedType = String(post.user_type || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (normalizedType === "superadmin" || normalizedType === "super_admin") return "Googer Support";
  return post.full_name || post.username || "Unknown";
}

export default function PostsPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Deactivate account popup state
  const [deactivateModal, setDeactivateModal] = useState<{ userId: number; username: string | null } | null>(null);
  const [deactivateCategory, setDeactivateCategory] = useState("");
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivating, setDeactivating] = useState(false);
  const [accessPostUser, setAccessPostUser] = useState<PostRow | null>(null);
  const [walletAccessChecked, setWalletAccessChecked] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const data = await adminService.fetchAdminPosts(searchTerm.trim());
        if (!active) return;
        setPosts(Array.isArray(data) ? data : []);
        if (!silent) setError(null);
      } catch (err: any) {
        if (!active) return;
        if (!silent) setError(err.message || "Failed to load posts");
      } finally {
        if (active && !silent) setLoading(false);
      }
    };
    load();
    const iv = setInterval(() => load(true), 30000);
    return () => { active = false; clearInterval(iv); };
  }, [searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const totals = useMemo(() => posts.reduce(
    (acc, p) => ({
      likes: acc.likes + Number(p.likes_count || 0),
      comments: acc.comments + Number(p.comments_count || 0),
      views: acc.views + Number(p.views_count || 0),
      shares: acc.shares + Number(p.shares_count || 0),
    }),
    { likes: 0, comments: 0, views: 0, shares: 0 }
  ), [posts]);

  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const pagedPosts = useMemo(
    () => posts.slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE),
    [currentPage, posts]
  );

  useEffect(() => {
    setCurrentPage(p => Math.min(p, totalPages));
  }, [totalPages]);

  const handleDelete = async (postId: number) => {
    setDeletingId(postId);
    try {
      await adminService.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      setConfirmDeleteId(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete post");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateModal) return;
    if (!deactivateCategory) return;
    if (deactivateCategory === "Other (Custom Reason)" && !deactivateReason.trim()) return;
    setDeactivating(true);
    try {
      await adminService.deactivateUser(deactivateModal.userId, true, deactivateCategory, {
        category: deactivateCategory,
        customReason: deactivateReason.trim(),
      });
      setPosts(prev => prev.map(p => p.user_id === deactivateModal.userId ? { ...p, is_deactivated: true, suspension_reason_category: deactivateCategory } : p));
      setDeactivateModal(null);
      setDeactivateCategory("");
      setDeactivateReason("");
      alert(`Account @${deactivateModal.username || deactivateModal.userId} has been deactivated.`);
    } catch (err: any) {
      alert(err.message || "Failed to deactivate account");
    } finally {
      setDeactivating(false);
    }
  };

  const openWalletAccess = (post: PostRow) => {
    setAccessPostUser(post);
    setWalletAccessChecked(Boolean(post.suspended_wallet_access));
  };

  const handleWalletAccess = async () => {
    if (!accessPostUser) return;
    try {
      const result = await adminService.updateSuspendedWalletAccess(accessPostUser.user_id, walletAccessChecked);
      const updated = result?.user;
      setPosts(prev => prev.map(p => p.user_id === accessPostUser.user_id ? {
        ...p,
        suspended_wallet_access: updated?.suspended_wallet_access ?? walletAccessChecked,
        wallet_balance: updated?.wallet_balance ?? p.wallet_balance,
      } : p));
      setAccessPostUser(null);
    } catch (err: any) {
      alert(err.message || "Failed to update wallet access");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Posts</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Googer Posts Management</h1>
        <p className="mt-1 text-sm font-medium text-slate-400">
          Review all Googer posts in one place with clear user identity, post text, engagement totals, and publish times.
        </p>
      </div>

      {/* Compact stats bar */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Total Posts", value: posts.length,    color: "text-cyan-300",    border: "border-cyan-500/20",    bg: "bg-cyan-500/[0.06]" },
          { label: "Likes",       value: totals.likes,    color: "text-rose-300",    border: "border-rose-500/20",    bg: "bg-rose-500/[0.06]" },
          { label: "Comments",    value: totals.comments, color: "text-amber-300",   border: "border-amber-500/20",   bg: "bg-amber-500/[0.06]" },
          { label: "Shares",      value: totals.shares,   color: "text-violet-300",  border: "border-violet-500/20",  bg: "bg-violet-500/[0.06]" },
          { label: "Views",       value: totals.views,    color: "text-emerald-300", border: "border-emerald-500/20", bg: "bg-emerald-500/[0.06]" },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-3 rounded-2xl border ${s.border} ${s.bg} px-4 py-2.5`}>
            <p className={`text-[9px] font-black uppercase tracking-[0.16em] ${s.color}`}>{s.label}</p>
            <p className="text-base font-black text-white">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Feed panel */}
      <div className="rounded-[2rem] border border-white/8 bg-[#09090b] shadow-2xl overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/6 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-semibold text-white/40">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
          <div className="relative w-full max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-500">
              <IonIcon name="search-outline" className="text-base" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, username, email, ID…"
              className="w-full rounded-[1.2rem] border border-white/8 bg-white/[0.04] py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-t-2 border-white" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Loading Posts</p>
          </div>
        ) : error ? (
          <div className="p-8">
            <div className="rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-5 py-4">
              <p className="text-xs font-black text-rose-300">{error}</p>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-16 text-center opacity-30">
            <IonIcon name="document-text-outline" className="mx-auto mb-3 block text-5xl" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">No posts found</p>
          </div>
        ) : (
          <>
            {pagedPosts.map(post => {
              const avatar = normalizeProfilePicture(post.profile_picture);
              const isConfirming = confirmDeleteId === post.id;
              const isDeleting = deletingId === post.id;
              const profileHref = `/admin/users/${post.user_id}`;
              return (
                <article key={post.id} className="border-b border-white/[0.06] last:border-b-0 px-5 py-5 transition-colors hover:bg-white/[0.02] sm:px-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      {/* Avatar — click to profile */}
                      <a href={profileHref} className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10 flex items-center justify-center hover:ring-2 hover:ring-white/20 transition-all">
                        {avatar
                          ? <img src={avatar} alt="" className="h-full w-full object-cover" />
                          : <IonIcon name="person-outline" className="text-sm text-white/40" />}
                      </a>

                      <div className="min-w-0">
                        {/* Name + time */}
                        <div className="flex min-w-0 items-center gap-2">
                          <a href={profileHref} className="truncate text-[13px] font-black text-white hover:text-blue-400 transition-colors">
                            {getPostUserDisplayName(post)}
                          </a>
                          <span className="text-xs text-white/35 shrink-0">{timeAgo(post.created_at)}</span>
                        </div>

                        {/* Post text */}
                        <div
                          className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-6"
                          style={{ color: post.text_color || "#ffffff" }}
                        >
                          {post.text || ""}
                        </div>

                        {/* Engagement icons */}
                        <div className="mt-4 flex items-center gap-5 text-white/80">
                          <span className="flex items-center gap-1 text-white/50">
                            <IonIcon name="heart-outline" className="text-[21px]" />
                            {post.likes_count > 0 && <span className="text-xs font-bold">{post.likes_count}</span>}
                          </span>
                          <span className="flex items-center gap-1 text-white/50">
                            <IonIcon name="chatbubble-outline" className="text-[21px]" />
                            {post.comments_count > 0 && <span className="text-xs font-bold">{post.comments_count}</span>}
                          </span>
                          <span className="flex items-center gap-1 text-white/50">
                            <IonIcon name="eye-outline" className="text-[21px]" />
                            {post.views_count > 0 && <span className="text-xs font-bold">{post.views_count}</span>}
                          </span>
                          <span className="flex items-center gap-1 text-white/50">
                            <IonIcon name="share-social-outline" className="text-[21px]" />
                            {post.shares_count > 0 && <span className="text-xs font-bold">{post.shares_count}</span>}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      {/* Deactivate account */}
                      {post.self_deactivated_at ? (
                        <span className="flex items-center gap-1 rounded-xl border border-blue-500/25 bg-blue-500/10 px-2.5 py-1.5 text-[10px] font-black text-blue-300">
                          <IonIcon name="eye-outline" className="text-xs" />
                          View Only
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => openWalletAccess(post)}
                            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[10px] font-black transition-all ${post.suspended_wallet_access ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"}`}
                          >
                            <IonIcon name={post.suspended_wallet_access ? "wallet" : "key-outline"} className="text-xs" />
                            Give Access
                          </button>
                          <button
                            onClick={async () => {
                              if (post.is_deactivated) {
                                await adminService.deactivateUser(post.user_id, false);
                                setPosts(prev => prev.map(p => p.user_id === post.user_id ? { ...p, is_deactivated: false, suspension_reason_category: null } : p));
                                return;
                              }
                              setDeactivateModal({ userId: post.user_id, username: post.username });
                              setDeactivateCategory("");
                              setDeactivateReason("");
                            }}
                            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[10px] font-black transition-all ${post.is_deactivated ? "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" : "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"}`}
                          >
                            <IonIcon name={post.is_deactivated ? "refresh-outline" : "ban-outline"} className="text-xs" />
                            {post.is_deactivated ? "Reactivate" : "Deactivate"}
                          </button>
                        </>
                      )}

                      {/* Remove post */}
                      {isConfirming ? (
                        <>
                          <button
                            onClick={() => handleDelete(post.id)}
                            disabled={isDeleting}
                            className="flex items-center gap-1 rounded-xl border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-[10px] font-black text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-50"
                          >
                            {isDeleting
                              ? <div className="h-3 w-3 animate-spin rounded-full border border-red-400/40 border-t-red-400" />
                              : <IonIcon name="trash-outline" className="text-xs" />}
                            {isDeleting ? "Removing…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black text-white/40 hover:text-white transition-all"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(post.id)}
                          className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-white/30 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-all"
                        >
                          <IonIcon name="trash-outline" className="text-xs" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
                <p className="text-[10px] font-semibold text-white/30">
                  {(currentPage - 1) * POSTS_PER_PAGE + 1}–{Math.min(currentPage * POSTS_PER_PAGE, posts.length)} of {posts.length}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(v => Math.max(1, v - 1))} disabled={currentPage === 1}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-white/50 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-30">Prev</button>
                  <span className="text-[10px] font-semibold text-white/40">{currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(v => Math.min(totalPages, v + 1))} disabled={currentPage === totalPages}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-white/50 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-30">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {accessPostUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-[2rem] border border-violet-500/20 bg-[#0a0a0a] p-6 shadow-2xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/10 text-violet-300">
                <IonIcon name="key-outline" className="text-xl" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Give Access</h3>
                <p className="text-xs font-bold text-white/40">@{accessPostUser.username || accessPostUser.user_id}</p>
              </div>
            </div>

            <label className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${walletAccessChecked ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black text-white/70">
                  <IonIcon name="wallet-outline" className="text-lg" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Wallet</p>
                  <p className="text-[10px] font-bold text-white/40">Allow My Wallet page only after deactivation</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={walletAccessChecked}
                onChange={(e) => setWalletAccessChecked(e.target.checked)}
                className="h-5 w-5 accent-emerald-500"
              />
            </label>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/35">User Wallet Balance</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xs font-black text-emerald-300">R</span>
                <span className="text-2xl font-black text-white">
                  {Number(accessPostUser.wallet_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setAccessPostUser(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/50 hover:text-white transition-all"
              >
                Close
              </button>
              <button
                onClick={handleWalletAccess}
                className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/15 py-2.5 text-sm font-black text-emerald-300 hover:bg-emerald-500/25 transition-all"
              >
                Give Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate account modal */}
      {deactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                <IonIcon name="ban-outline" className="text-xl" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Deactivate Account</h3>
                <p className="text-[11px] text-white/40">@{deactivateModal.username || deactivateModal.userId}</p>
              </div>
            </div>

            <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-2">
              Reason category <span className="text-red-400">*</span>
            </label>
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1">
              {SUSPENSION_REASONS.map(reason => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setDeactivateCategory(reason)}
                  className={`rounded-xl border px-3 py-2 text-left text-[11px] font-bold transition-all ${deactivateCategory === reason ? "border-orange-400/50 bg-orange-500/15 text-orange-200" : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"}`}
                >
                  <span className="text-orange-400">??</span> {reason}
                </button>
              ))}
            </div>
            {deactivateCategory === "Other (Custom Reason)" && (
              <textarea
                value={deactivateReason}
                onChange={e => setDeactivateReason(e.target.value)}
                placeholder="Enter custom reason..."
                rows={3}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-orange-500/30 resize-none"
              />
            )}
            <p className="mt-2 text-[10px] text-white/30">This creates a Temporary Suspension (7 Days) and allows the user to appeal.</p>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setDeactivateModal(null); setDeactivateCategory(""); setDeactivateReason(""); }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/50 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={deactivating || !deactivateCategory || (deactivateCategory === "Other (Custom Reason)" && !deactivateReason.trim())}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/15 py-2.5 text-sm font-black text-orange-400 hover:bg-orange-500/25 transition-all disabled:opacity-40"
              >
                {deactivating
                  ? <><div className="h-4 w-4 animate-spin rounded-full border border-orange-400/40 border-t-orange-400" />Deactivating…</>
                  : <><IonIcon name="ban-outline" />Deactivate Account</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

