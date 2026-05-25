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
  googer_user_id: string | null;
  email: string | null;
  profile_picture: string | null;
};

const POSTS_PER_PAGE = 3;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function normalizeProfilePicture(value?: string | null) {
  if (!value) return "";
  if (value.startsWith("http") || value.startsWith("data:") || value.startsWith("/")) return value;
  return `/uploads/${value.split(/[\\/]/).pop()}`;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [testLink, setTestLink] = useState("");
  const [submittingLink, setSubmittingLink] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;

    const loadPosts = async (isPolling = false) => {
      try {
        if (!isPolling) setLoading(true);
        const data = await adminService.fetchAdminPosts(searchTerm.trim());
        if (!active) return;
        setPosts(Array.isArray(data) ? data : []);
        if (!isPolling) setError(null);
      } catch (err: any) {
        console.error(err);
        if (!active) return;
        if (!isPolling) setError(err.message || "Failed to load posts");
      } finally {
        if (active && !isPolling) setLoading(false);
      }
    };

    loadPosts(false);
    const interval = setInterval(() => loadPosts(true), 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [searchTerm]);

  const handleSubmit = async () => {
    if (!testLink.trim()) return;
    try {
      setSubmittingLink(true);
      await adminService.addTestLink(testLink.trim());
      setTestLink("");
      alert("Test link added successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to add test link");
    } finally {
      setSubmittingLink(false);
    }
  };

  const totals = useMemo(() => {
    return posts.reduce(
      (acc, post) => {
        acc.likes += Number(post.likes_count || 0);
        acc.comments += Number(post.comments_count || 0);
        acc.views += Number(post.views_count || 0);
        acc.shares += Number(post.shares_count || 0);
        return acc;
      },
      { likes: 0, comments: 0, views: 0, shares: 0 }
    );
  }, [posts]);

  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const pagedPosts = useMemo(
    () => posts.slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE),
    [currentPage, posts]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Posts</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Googer Posts Management</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-400">
            Review all Googer posts in one place with clear user identity, post text, engagement totals, and publish times.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-[1.8rem] border border-cyan-500/20 bg-cyan-500/[0.06] p-4 sm:p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300/70">Total Posts</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-white">{posts.length}</p>
        </div>
        <div className="rounded-[1.8rem] border border-rose-500/20 bg-rose-500/[0.06] p-4 sm:p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-rose-300/70">Likes</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-white">{totals.likes}</p>
        </div>
        <div className="rounded-[1.8rem] border border-amber-500/20 bg-amber-500/[0.06] p-4 sm:p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300/70">Comments</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-white">{totals.comments}</p>
        </div>
        <div className="rounded-[1.8rem] border border-violet-500/20 bg-violet-500/[0.06] p-4 sm:p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-300/70">Shares</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-white">{totals.shares}</p>
        </div>
        <div className="rounded-[1.8rem] border border-emerald-500/20 bg-emerald-500/[0.06] p-4 sm:p-5 col-span-2 md:col-span-1">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/70">Views</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-white">{totals.views}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[2rem] border border-white/8 bg-[#09090b] shadow-2xl overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-white/6 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-white">All Googer Posts</h2>
              <p className="mt-1 text-[11px] font-semibold text-white/40">
                Every post with the post owner, Googer ID, engagement numbers, and publish time.
              </p>
            </div>
            <div className="relative w-full max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">
                <IonIcon name="search-outline" className="text-lg" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search post text, user name, username, email, or Googer ID..."
                className="w-full rounded-[1.2rem] border border-white/8 bg-white/[0.04] py-3 pl-12 pr-4 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/30 focus:ring-4 focus:ring-cyan-500/5"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-16 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-t-2 border-white" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Loading Posts</p>
            </div>
          ) : error ? (
            <div className="p-8">
              <div className="rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-300">Failed to load posts</p>
                <p className="mt-2 text-sm font-medium text-rose-200/75">{error}</p>
              </div>
            </div>
          ) : posts.length === 0 ? (
            <div className="p-16 text-center">
              <IonIcon name="document-text-outline" className="mx-auto mb-4 block text-5xl text-white/10" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">No posts found</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-white/[0.05]">
                {pagedPosts.map((post) => {
                const avatarSrc = normalizeProfilePicture(post.profile_picture);
                return (
                  <div key={post.id} className="p-5 transition-colors hover:bg-white/[0.025]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-white/10 bg-white/[0.05]">
                          {avatarSrc ? (
                            <img src={avatarSrc} alt={post.full_name || post.username || "User"} className="h-full w-full object-cover" />
                          ) : (
                            <IonIcon name="person-outline" className="text-xl text-white/50" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-black text-white">{post.full_name || "Unknown User"}</p>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white/45">
                              @{post.username || "unknown"}
                            </span>
                            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-cyan-300">
                              ID {post.googer_user_id || "—"}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] font-semibold text-white/40">{post.email || "No email"}</p>

                          <div
                            className="mt-4 max-w-3xl rounded-[1.35rem] border border-white/8 bg-white/[0.035] px-4 py-4"
                            style={{ color: post.text_color || "#FFFFFF" }}
                          >
                            <p className="whitespace-pre-wrap break-words text-sm font-bold leading-6">{post.text || "No post text"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid min-w-[260px] grid-cols-2 gap-3 lg:w-[300px]">
                        <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">Likes</p>
                          <p className="mt-2 text-sm font-black text-white">{post.likes_count || 0}</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">Comments</p>
                          <p className="mt-2 text-sm font-black text-white">{post.comments_count || 0}</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">Views</p>
                          <p className="mt-2 text-sm font-black text-white">{post.views_count || 0}</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">Shares</p>
                          <p className="mt-2 text-sm font-black text-white">{post.shares_count || 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/45">
                          Post #{post.id}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/45">
                          Share Code {post.share_code || "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">Published</p>
                        <p className="mt-1 text-[11px] font-bold text-white/60">{formatDateTime(post.created_at)}</p>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/30">
                  Showing {(currentPage - 1) * POSTS_PER_PAGE + 1}-{Math.min(currentPage * POSTS_PER_PAGE, posts.length)} of {posts.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                  >
                    Prev
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-[0.08em] text-white/40">
                    Page {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/8 bg-[#09090b] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                <IonIcon name="flash-outline" className="text-xl" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Posts Overview</h3>
                <p className="text-[10px] font-semibold text-white/40">Professional summary for the current Googer feed.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">Most Recent Post Time</p>
                <p className="mt-2 text-sm font-black text-white">{posts[0] ? formatDateTime(posts[0].created_at) : "—"}</p>
              </div>
              <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">Unique Post Authors</p>
                <p className="mt-2 text-sm font-black text-white">{new Set(posts.map((post) => post.user_id)).size}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/8 bg-[#09090b] p-6 shadow-2xl">
            <h3 className="text-sm font-black text-white">Add Test Link</h3>
            <p className="mt-1 text-[10px] font-semibold text-white/40">Keep this as a utility action without taking over the whole page.</p>
            <div className="mt-4 space-y-3">
              <input
                type="url"
                value={testLink}
                onChange={(e) => setTestLink(e.target.value)}
                placeholder="https://example.com/test-content"
                className="w-full rounded-[1.1rem] border border-white/8 bg-white/[0.04] px-4 py-3 text-xs font-medium text-white placeholder:text-slate-600 focus:border-white/20 focus:outline-none"
              />
              <button
                onClick={handleSubmit}
                disabled={submittingLink || !testLink.trim()}
                className="inline-flex h-11 w-full items-center justify-center rounded-[1.1rem] bg-white text-[10px] font-black uppercase tracking-[0.14em] text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-black/40"
              >
                {submittingLink ? "Adding..." : "Add Test Link"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
