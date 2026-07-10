"use client";

import { useEffect, useMemo, useState } from "react";
import IonIcon from "./IonIcon";

type SheetType = "likes" | "comments" | "shares" | "views";

type InteractionRecord = {
  id?: string | number;
  user_id?: string | number | null;
  username?: string | null;
  full_name?: string | null;
  profile_picture?: string | null;
  created_at?: string | null;
  text?: string | null;
  parent_id?: string | number | null;
};

type PostPreview = {
  id: number;
  text?: string | null;
  username?: string | null;
  full_name?: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  type: SheetType;
  onTabChange: (type: SheetType) => void;
  post: PostPreview | null;
  data: InteractionRecord[];
  isLoading?: boolean;
};

const TABS: { type: SheetType; label: string; icon: string }[] = [
  { type: "likes", label: "Likes", icon: "heart-outline" },
  { type: "comments", label: "Comments", icon: "chatbubble-outline" },
  { type: "shares", label: "Shares", icon: "share-social-outline" },
  { type: "views", label: "Views", icon: "eye-outline" },
];

const TITLES: Record<SheetType, string> = {
  likes: "Who Liked This",
  comments: "Comments",
  shares: "Who Shared",
  views: "Who Viewed",
};

function timeAgo(value?: string | null) {
  if (!value) return "";
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

export default function GoogInteractionBottomSheet({
  isOpen,
  onClose,
  type,
  onTabChange,
  post,
  data,
  isLoading = false,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(false);
  const [commentFilter, setCommentFilter] = useState<"all" | "recent" | "top">("all");

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      const frame = requestAnimationFrame(() => {
        const nextFrame = requestAnimationFrame(() => setSlide(true));
        return () => cancelAnimationFrame(nextFrame);
      });
      document.body.style.overflow = "hidden";
      return () => cancelAnimationFrame(frame);
    }

    setSlide(false);
    const timeoutId = window.setTimeout(() => setVisible(false), 350);
    document.body.style.overflow = "";
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  const sortedComments = useMemo(() => {
    const comments = [...data];

    if (commentFilter === "recent") {
      comments.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } else {
      comments.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    }

    return comments;
  }, [commentFilter, data]);

  const structuredComments = useMemo(() => (
    sortedComments.reduce<Array<InteractionRecord & { replies: InteractionRecord[] }>>((acc, item) => {
      if (!item.parent_id) {
        acc.push({
          ...item,
          replies: sortedComments.filter((entry) => String(entry.parent_id || "") === String(item.id || "")),
        });
      }
      return acc;
    }, [])
  ), [sortedComments]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[250] flex items-end justify-center transition-all duration-300 ${slide ? "bg-black/60 backdrop-blur-md opacity-100" : "bg-black/0 opacity-0"}`}
      onClick={onClose}
    >
      <div
        className={`relative flex w-full max-w-lg flex-col rounded-t-[2.5rem] border-t border-white/10 bg-[#0d0d0d] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 ${slide ? "translate-y-0" : "translate-y-full"}`}
        style={{ maxHeight: "85dvh" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex w-full justify-center pb-1 pt-3 shrink-0">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between gap-1 border-b border-white/[0.05] bg-black/20 px-4 py-3 shrink-0">
          {TABS.map((tab) => {
            const active = tab.type === type;
            return (
              <button
                key={tab.type}
                type="button"
                onClick={() => onTabChange(tab.type)}
                className={`flex min-w-[70px] flex-1 flex-col items-center gap-1.5 rounded-2xl py-2.5 transition-all ${active ? "bg-white/10 shadow-lg shadow-white/5" : "hover:bg-white/[0.05]"}`}
              >
                <div className="relative flex h-6 w-6 items-center justify-center">
                  <IonIcon name={tab.icon} className={`text-[20px] ${active ? "text-white" : "text-white/70"}`} />
                  {active && isLoading ? (
                    <div className="absolute -right-2 -top-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  ) : null}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-[0.1em] ${active ? "text-white" : "text-white/40"}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div className="min-w-0">
            <h3 className="truncate text-base font-black uppercase tracking-tight text-white">{TITLES[type]}</h3>
            {post?.full_name || post?.username || post?.text ? (
              <p className="truncate text-[9px] font-black uppercase tracking-widest text-slate-500">
                {post?.full_name || post?.username || post?.text}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
          >
            <IonIcon name="close" />
          </button>
        </div>

        <div className="min-h-[80px] flex-1 overflow-y-auto px-4 pb-2" style={{ overscrollBehavior: "contain" }}>
          {type === "comments" && !isLoading && data.length > 0 ? (
            <div className="mb-4 flex w-fit items-center gap-1 rounded-xl bg-white/5 p-1">
              {[
                { key: "all", label: "All" },
                { key: "recent", label: "Recent" },
                { key: "top", label: "Top Rated" },
              ].map((option) => {
                const active = commentFilter === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setCommentFilter(option.key as "all" | "recent" | "top")}
                    className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase transition-all ${active ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {isLoading && data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-white" />
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Loading...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14">
              <IonIcon name={TABS.find((item) => item.type === type)?.icon || "chatbubble-outline"} className="text-4xl text-white/20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                {type === "comments" ? "No comments yet." : type === "likes" ? "No likes yet." : type === "views" ? "No views recorded yet." : "Nothing shared yet."}
              </p>
            </div>
          ) : type === "comments" ? (
            <div className="flex flex-col gap-2 py-1">
              {structuredComments.map((comment) => (
                <div key={String(comment.id)} className="flex flex-col gap-2">
                  <CommentRow item={comment} />
                  {comment.replies.map((reply) => (
                    <CommentRow key={String(reply.id)} item={reply} isReply />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 py-1">
              {data.map((item, index) => (
                <div
                  key={String(item.id || index)}
                  className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] p-3 transition-all hover:bg-white/[0.05]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-500/20 bg-blue-500/10">
                    {item.profile_picture ? (
                      <img src={item.profile_picture} alt={item.full_name || item.username || "User"} className="h-full w-full object-cover" />
                    ) : (
                      <IonIcon name="person" className="text-sm text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[11px] font-black uppercase tracking-tight text-white">
                        {item.full_name || item.username || "Anonymous"}
                      </span>
                      <span className="ml-auto shrink-0 text-[8px] font-bold uppercase tracking-widest text-slate-600">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {type === "comments" ? (
          <div className="shrink-0 border-t border-white/5 bg-[#0a0a0a] px-4 py-3">
            <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto px-0.5">
              {["❤", "😂", "😍", "🔥", "🙌", "👏", "💯", "✨"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/[0.03] text-sm"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-white/5 bg-[#1a1a1a] p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10">
                  <IonIcon name="person" className="text-sm text-blue-400" />
                </div>
                <input
                  type="text"
                  disabled
                  value=""
                  placeholder="Admin preview only"
                  className="flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[13px] font-medium text-white/40 outline-none placeholder:text-white/20"
                />
                <button
                  type="button"
                  disabled
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/40 text-white/50"
                >
                  <IonIcon name="send" className="text-sm" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CommentRow({ item, isReply = false }: { item: InteractionRecord; isReply?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 ${isReply ? "mb-2 ml-8" : "mb-3"}`}>
      <div className={`${isReply ? "h-6 w-6" : "h-8 w-8"} mt-0.5 flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-500/20 bg-blue-500/10`}>
        {item.profile_picture ? (
          <img src={item.profile_picture} alt={item.username || "User"} className="h-full w-full object-cover" />
        ) : (
          <IonIcon name="person" className={`${isReply ? "text-[9px]" : "text-xs"} text-blue-400`} />
        )}
      </div>

      <div className="flex max-w-[85%] flex-col items-start">
        <div className="relative rounded-[1.25rem] border border-white/5 bg-white/[0.045] px-3 py-2 transition-colors hover:bg-white/[0.07]">
          <div className="mb-0.5 flex items-center gap-2">
            <span className={`${isReply ? "text-[9px]" : "text-[10px]"} truncate font-black uppercase tracking-tight text-white`}>
              {item.full_name || item.username || "Anonymous"}
            </span>
            <span className="ml-auto shrink-0 text-[7px] font-bold uppercase tracking-widest text-slate-600">
              {timeAgo(item.created_at)}
            </span>
          </div>
          {item.text ? (
            <p className={`${isReply ? "text-[10.5px]" : "text-[11.5px]"} font-medium leading-normal text-slate-300`}>
              {item.text}
            </p>
          ) : null}
        </div>

        <div className="ml-1 mt-1.5 flex items-center gap-2 text-slate-400">
          <span className="flex items-center gap-1 rounded-full p-1 text-[11px] font-black">
            <IonIcon name="thumbs-up-outline" className="text-[14px]" />
          </span>
          <span className="flex items-center gap-1 rounded-full p-1 text-[11px] font-black">
            <IonIcon name="thumbs-down-outline" className="text-[14px]" />
          </span>
          {!isReply ? (
            <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Reply
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
