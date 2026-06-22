"use client";
import { useEffect, useState, useMemo } from "react";
import IonIcon from "../../components/IonIcon";
import Image from "next/image";
import { chatService } from "../../services/chatService";
import { authService } from "../../services/authService";
import { adminService } from "../../services/adminService";

type UserGroup = "all" | "user" | "seller" | "employee" | "admin";
type User = { id: number; username: string; full_name: string; user_id: string; user_type: string; profile_picture?: string };
type View = "users" | "history" | "assignments";
type ComposeMode = "notification" | "chat";
type HistoryMode = "notifications" | "chats";
type ProductStatusAssignment = {
  product_status_id: string;
  assigned_admin_id: number;
  assigned_admin?: { id: number; name: string; username?: string | null };
  buyer?: { id: number | null; name: string; username?: string | null };
  seller?: { id: number | null; name: string; username?: string | null };
  order_number?: string | null;
  updated_at?: string | null;
  last_message?: { text?: string | null; type?: string | null; created_at?: string | null } | null;
};
type TopupRequestAssignment = {
  topup_request_id: number;
  request_user_id: number | null;
  requester?: { id: number | null; name: string; username?: string | null };
  assigned_admin_id: number;
  assigned_admin?: { id: number; name: string; username?: string | null };
  updated_at?: string | null;
  last_message?: { text?: string | null; created_at?: string | null } | null;
};

const ASSIGNMENTS_CACHE_KEY = "googer_notifications_assignments_cache";
const TOPUP_ASSIGNMENTS_CACHE_KEY = "googer_notifications_topup_assignments_cache";

type OrderAssignmentRecord = {
  product_status_id: string;
  order_number: string;
  buyer_id: number | null;
  buyer_name: string;
  buyer_username: string;
  seller_id: number | null;
  seller_name: string;
  seller_username: string;
};
type TopupAssignmentRecord = {
  topup_request_id: number;
  request_user_id: number | null;
  username: string;
  full_name: string;
  status: string;
  amount: string;
};

const GROUP_TABS: { key: UserGroup; label: string; color: string }[] = [
  { key: "all",      label: "All",       color: "bg-white text-black" },
  { key: "user",     label: "Users",     color: "bg-blue-500/20 text-blue-300" },
  { key: "seller",   label: "Sellers",   color: "bg-emerald-500/20 text-emerald-300" },
  { key: "employee", label: "Employees", color: "bg-amber-500/20 text-amber-300" },
  { key: "admin",    label: "Admins",    color: "bg-purple-500/20 text-purple-300" },
];

// Preset gradient themes admin can pick from
const GRADIENT_PRESETS = [
  { label: "Sapphire",  value: "linear-gradient(135deg,#1a6cf6,#0ea5e9)",  from: "#1a6cf6", to: "#0ea5e9" },
  { label: "Emerald",   value: "linear-gradient(135deg,#059669,#34d399)",  from: "#059669", to: "#34d399" },
  { label: "Sunset",    value: "linear-gradient(135deg,#f97316,#ec4899)",  from: "#f97316", to: "#ec4899" },
  { label: "Violet",    value: "linear-gradient(135deg,#7c3aed,#a78bfa)",  from: "#7c3aed", to: "#a78bfa" },
  { label: "Rose",      value: "linear-gradient(135deg,#e11d48,#fb7185)",  from: "#e11d48", to: "#fb7185" },
  { label: "Gold",      value: "linear-gradient(135deg,#d97706,#fbbf24)",  from: "#d97706", to: "#fbbf24" },
  { label: "Ocean",     value: "linear-gradient(135deg,#0f766e,#22d3ee)",  from: "#0f766e", to: "#22d3ee" },
  { label: "Slate",     value: "linear-gradient(135deg,#334155,#94a3b8)",  from: "#334155", to: "#94a3b8" },
  { label: "Custom",    value: "custom",                                    from: "#6366f1", to: "#ec4899" },
];

function parseServerTime(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return new Date(NaN);
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized)) return new Date(normalized);
  return new Date(`${normalized.replace(" ", "T")}Z`);
}

function timeAgo(v: string) {
  const d = Date.now() - parseServerTime(v).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function resolveAvatar(pic: string | undefined, name: string) {
  if (!pic) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&size=80&background=random`;
  const p = pic.replace(/\s/g, "").replace(/[\\"]/g, "");
  if (p.startsWith("http") || p.startsWith("data:")) return p;
  return `/uploads/${p.split(/[\\/]/).pop()}`;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function runSettledInBatches<T>(
  tasks: Array<() => Promise<T>>,
  options?: { batchSize?: number; pauseMs?: number }
) {
  const batchSize = Math.max(1, options?.batchSize ?? 8);
  const pauseMs = Math.max(0, options?.pauseMs ?? 200);
  const results: PromiseSettledResult<T>[] = [];

  for (let index = 0; index < tasks.length; index += batchSize) {
    const batch = tasks.slice(index, index + batchSize);
    const batchResults = await Promise.allSettled(batch.map((task) => task()));
    results.push(...batchResults);
    if (index + batchSize < tasks.length && pauseMs > 0) {
      await wait(pauseMs);
    }
  }

  return results;
}

function buildOrderAssignmentRecords(rows: any[]): OrderAssignmentRecord[] {
  const map = new Map<string, OrderAssignmentRecord>();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const productStatusId = String(row?.order_number || row?.id || "").trim();
    if (!productStatusId || map.has(productStatusId)) return;
    map.set(productStatusId, {
      product_status_id: productStatusId,
      order_number: productStatusId,
      buyer_id: row?.buyer_id == null ? null : Number(row.buyer_id),
      buyer_name: row?.buyer_name || row?.buyer_username || "Buyer",
      buyer_username: row?.buyer_username || "-",
      seller_id: row?.seller_id == null ? null : Number(row.seller_id),
      seller_name: row?.seller_name || row?.seller_username || "Seller",
      seller_username: row?.seller_username || "-",
    });
  });
  return Array.from(map.values());
}

const token = () => typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
const hdrs = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

async function fetchGlobalChatAssignment() {
  const response = await fetch("/googer-api/admin/customization/chat-assignment", {
    headers: hdrs(),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || "Failed to load chat assignment");
  return Number(result?.assignment?.assigned_admin_id || 0);
}

async function saveGlobalChatAssignment(assignedAdminId: number | null) {
  const response = await fetch("/googer-api/admin/customization/chat-assignment", {
    method: "PUT",
    headers: hdrs(),
    body: JSON.stringify({ assignedAdminId: assignedAdminId ?? null }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || "Failed to save chat assignment");
  return Number(result?.assignment?.assigned_admin_id || 0);
}

export default function NotificationsPage() {
  const [view, setView] = useState<View>("users");
  const [groupTab, setGroupTab] = useState<UserGroup>("all");
  const [currentUserType, setCurrentUserType] = useState("");

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [assignments, setAssignments] = useState<ProductStatusAssignment[]>([]);
  const [topupAssignments, setTopupAssignments] = useState<TopupRequestAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [orderRecords, setOrderRecords] = useState<OrderAssignmentRecord[]>([]);
  const [topupRecords, setTopupRecords] = useState<TopupAssignmentRecord[]>([]);
  const [orderRecordsLoading, setOrderRecordsLoading] = useState(false);
  const [topupRecordsLoading, setTopupRecordsLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, number>>({});
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [topupSearch, setTopupSearch] = useState("");
  const [bulkChatsAdminId, setBulkChatsAdminId] = useState<number>(0);
  const [bulkOrdersAdminId, setBulkOrdersAdminId] = useState<number>(0);
  const [bulkTopupsAdminId, setBulkTopupsAdminId] = useState<number>(0);
  const [adminSearch, setAdminSearch] = useState("");
  const [assignmentActionKey, setAssignmentActionKey] = useState<string | null>(null);
  const [assignmentFeedback, setAssignmentFeedback] = useState<string | null>(null);
  const [globalChatsAdminId, setGlobalChatsAdminId] = useState<number>(0);
  const [chatSenderAdminId, setChatSenderAdminId] = useState<number>(0);

  // Selected users for bulk send
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [composeMode, setComposeMode] = useState<ComposeMode>("notification");
  const [formType, setFormType] = useState("info");
  const [customType, setCustomType] = useState("");
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [sendToGroup, setSendToGroup] = useState<UserGroup>("all");
  const [gradientPreset, setGradientPreset] = useState(GRADIENT_PRESETS[0]);
  const [customFrom, setCustomFrom] = useState("#6366f1");
  const [customTo, setCustomTo] = useState("#ec4899");
  const [fontColor, setFontColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState("normal");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [historyMode, setHistoryMode] = useState<HistoryMode>("notifications");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyGroup, setHistoryGroup] = useState<UserGroup>("all");

  const loadUsers = async () => {
    try {
      const r = await fetch("/api/users/all", { headers: hdrs() });
      const d = await r.json();
      setUsers(d || []);
    } catch { }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const [notificationResponse, chatResponse] = await Promise.all([
        fetch("/api/notifications/all", { headers: hdrs() }),
        fetch("/api/notifications/chat-history", { headers: hdrs() }),
      ]);
      const notificationData = await notificationResponse.json().catch(() => ({}));
      const chatData = await chatResponse.json().catch(() => ({}));
      if (notificationResponse.ok) setHistory(notificationData.notifications || []);
      if (chatResponse.ok) setChatHistory(chatData.chat_history || []);
    } catch { } finally { setHistoryLoading(false); }
  };

  const loadAssignments = async () => {
    setAssignmentsLoading(true);
    try {
      const [productRows, topupRows] = await Promise.all([
        chatService.listAssignedProductStatusChats(),
        chatService.listAssignedTopupRequestChats(),
      ]);
      const nextAssignments = Array.isArray(productRows) ? productRows : [];
      const nextTopupAssignments = Array.isArray(topupRows) ? topupRows : [];
      setAssignments(nextAssignments);
      setTopupAssignments(nextTopupAssignments);
      window.localStorage.setItem(ASSIGNMENTS_CACHE_KEY, JSON.stringify(nextAssignments));
      window.localStorage.setItem(TOPUP_ASSIGNMENTS_CACHE_KEY, JSON.stringify(nextTopupAssignments));
    } catch (err) {
      console.error("Failed to load assignment rows", err);
      try {
        const cachedAssignments = JSON.parse(window.localStorage.getItem(ASSIGNMENTS_CACHE_KEY) || "[]");
        const cachedTopupAssignments = JSON.parse(window.localStorage.getItem(TOPUP_ASSIGNMENTS_CACHE_KEY) || "[]");
        if (Array.isArray(cachedAssignments)) setAssignments(cachedAssignments);
        if (Array.isArray(cachedTopupAssignments)) setTopupAssignments(cachedTopupAssignments);
      } catch {}
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const loadOrderRecords = async () => {
    setOrderRecordsLoading(true);
    try {
      const rows = await adminService.fetchAllOrders();
      setOrderRecords(buildOrderAssignmentRecords(Array.isArray(rows) ? rows : []));
    } catch {
      setOrderRecords([]);
    } finally {
      setOrderRecordsLoading(false);
    }
  };

  const loadTopupRecords = async () => {
    setTopupRecordsLoading(true);
    try {
      const rows = await adminService.fetchCoinRequests();
      setTopupRecords((Array.isArray(rows) ? rows : []).map((row: any) => ({
        topup_request_id: Number(row.id),
        request_user_id: row.user_id == null ? null : Number(row.user_id),
        username: row.username || "-",
        full_name: row.full_name || row.username || "User",
        status: row.status || "Pending",
        amount: row.amount || "0",
      })));
    } catch {
      setTopupRecords([]);
    } finally {
      setTopupRecordsLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => {
    authService.getProfile()
      .then((profile: any) => setCurrentUserType(String(profile?.user_type || "")))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const syncGlobalChatAssignment = () => {
      fetchGlobalChatAssignment()
        .then((assignedAdminId) => {
          setGlobalChatsAdminId(assignedAdminId);
          setBulkChatsAdminId(assignedAdminId);
          setChatSenderAdminId((current) => current || assignedAdminId);
        })
        .catch(() => {});
    };

    syncGlobalChatAssignment();
    window.addEventListener("focus", syncGlobalChatAssignment);
    return () => window.removeEventListener("focus", syncGlobalChatAssignment);
  }, []);
  useEffect(() => {
    if (view === "history") loadHistory();
    if (view === "assignments") {
      loadAssignments();
      loadOrderRecords();
      loadTopupRecords();
    }
  }, [view]);
  useEffect(() => {
    setBulkChatsAdminId(globalChatsAdminId || 0);
  }, [globalChatsAdminId]);

  // Derived filtered list for user view
  const filteredUsers = useMemo(() => {
    let list = users;
    if (groupTab !== "all") list = list.filter(u => (u.user_type || "user").toLowerCase() === groupTab);
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      list = list.filter(u =>
        u.username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        String(u.user_id || "").includes(q)
      );
    }
    return list;
  }, [users, groupTab, userSearch]);

  // Group counts
  const groupCounts = useMemo(() => {
    const map: Record<string, number> = { all: users.length };
    users.forEach(u => {
      const t = (u.user_type || "user").toLowerCase();
      map[t] = (map[t] || 0) + 1;
    });
    return map;
  }, [users]);

  const activeThemeColor = gradientPreset.value === "custom"
    ? `linear-gradient(135deg,${customFrom},${customTo})`
    : gradientPreset.value;
  const resolvedType = formType === "custom" && customType.trim() ? customType.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 30) : formType;
  const previewTitleSize = fontSize === "large" ? "16px" : fontSize === "small" ? "12px" : "14px";
  const previewMessageSize = fontSize === "large" ? "11px" : fontSize === "small" ? "9px" : "10px";

  const openFormForUser = (user: User) => {
    setTargetUser(user);
    setSendToGroup("all");
    setComposeMode("notification");
    setFormTitle(""); setFormMessage(""); setFormType("info"); setCustomType("");
    setGradientPreset(GRADIENT_PRESETS[0]);
    setFontColor("#ffffff"); setFontSize("normal");
    setChatSenderAdminId(globalChatsAdminId || 0);
    setSent(null);
    setShowForm(true);
  };

  const openFormForGroup = (group: UserGroup) => {
    setTargetUser(null);
    setSendToGroup(group);
    setComposeMode("notification");
    setFormTitle(""); setFormMessage(""); setFormType("info"); setCustomType("");
    setGradientPreset(GRADIENT_PRESETS[0]);
    setFontColor("#ffffff"); setFontSize("normal");
    setChatSenderAdminId(globalChatsAdminId || 0);
    setSent(null);
    setShowForm(true);
  };

  const openFormForSelected = () => {
    setTargetUser(null);
    setSendToGroup("all");
    setComposeMode("notification");
    setFormTitle(""); setFormMessage(""); setFormType("info"); setCustomType("");
    setGradientPreset(GRADIENT_PRESETS[0]);
    setFontColor("#ffffff"); setFontSize("normal");
    setChatSenderAdminId(globalChatsAdminId || 0);
    setSent(null);
    setShowForm(true);
  };

  const openFormForAssignedAdmins = () => {
    setSelectedIds(new Set(assignedAdminIds));
    setTargetUser(null);
    setSendToGroup("all");
    setComposeMode("notification");
    setFormTitle(""); setFormMessage(""); setFormType("info"); setCustomType("");
    setGradientPreset(GRADIENT_PRESETS[0]);
    setFontColor("#ffffff"); setFontSize("normal");
    setChatSenderAdminId(globalChatsAdminId || 0);
    setSent(null);
    setShowForm(true);
  };

  const openChatForSelected = () => {
    setTargetUser(null);
    setSendToGroup("all");
    setComposeMode("chat");
    setFormTitle("");
    setFormMessage("");
    setFormType("info");
    setCustomType("");
    setGradientPreset(GRADIENT_PRESETS[0]);
    setFontColor("#ffffff");
    setFontSize("normal");
    setChatSenderAdminId(globalChatsAdminId || 0);
    setSent(null);
    setShowForm(true);
  };

  const assignGlobalChatsAdmin = async () => {
    if (!bulkChatsAdminId) return;
    setAssignmentActionKey("assign-all");
    try {
      const assignedAdminId = await saveGlobalChatAssignment(Number(bulkChatsAdminId));
      setGlobalChatsAdminId(assignedAdminId);
      setChatSenderAdminId(assignedAdminId);
      setAssignmentFeedback("Assigned admin for all chats only. Orders and top-ups stay separate.");
    } catch (err: any) {
      setAssignmentFeedback(err?.message || "Failed to assign all chats admin.");
    } finally {
      setAssignmentActionKey(null);
    }
  };

  const unassignGlobalChatsAdmin = async () => {
    setAssignmentActionKey("unassign-all");
    try {
      await saveGlobalChatAssignment(null);
      setGlobalChatsAdminId(0);
      setChatSenderAdminId(0);
      setAssignmentFeedback("Removed all-chats admin. Orders and top-ups stay unchanged.");
    } catch (err: any) {
      setAssignmentFeedback(err?.message || "Failed to unassign all chats admin.");
    } finally {
      setAssignmentActionKey(null);
    }
  };

  const applyBulkAssignment = async (
    scope: "orders" | "topups" | "all",
    mode: "assign" | "unassign",
    selectedAdminId?: number,
  ) => {
    const resolvedAdminId = Number(selectedAdminId || 0);
    if (mode === "assign" && !resolvedAdminId) return;

    const orderIds = orderRecords.map((record) => record.product_status_id).filter(Boolean);
    const topupIds = topupRecords.map((record) => Number(record.topup_request_id)).filter(Boolean);
    const tasks: Array<() => Promise<{ scope: "orders" | "topups"; id: string | number }>> = [];

    if (scope === "orders" || scope === "all") {
      orderIds.forEach((productStatusId) => {
        tasks.push(() =>
          chatService
            .assignProductStatusAdmin(productStatusId, mode === "assign" ? selectedAdminId : null)
            .then(() => ({ scope: "orders" as const, id: productStatusId }))
        );
      });
    }

    if (scope === "topups" || scope === "all") {
      topupIds.forEach((topupRequestId) => {
        tasks.push(() =>
          chatService
            .assignTopupRequestAdmin(topupRequestId, mode === "assign" ? selectedAdminId : null)
            .then(() => ({ scope: "topups" as const, id: topupRequestId }))
        );
      });
    }

    if (tasks.length === 0) {
      setAssignmentFeedback("No records available for assignment.");
      return;
    }

    const actionKey = `${mode}-${scope}`;
    setAssignmentActionKey(actionKey);
    try {
      const label = scope === "orders" ? "orders" : scope === "topups" ? "top-up requests" : "orders and top-up requests";
      const results = await runSettledInBatches(tasks, { batchSize: 6, pauseMs: 250 });
      const succeeded = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.filter((result) => result.status === "rejected") as PromiseRejectedResult[];

      await Promise.all([loadAssignments(), loadOrderRecords(), loadTopupRecords()]);

      if (failed.length === 0) {
        setAssignmentFeedback(
          mode === "assign"
            ? `Assigned admin to all ${label}.`
            : `Unassigned admin from all ${label}.`
        );
        return;
      }

      const firstReason = failed[0]?.reason instanceof Error
        ? failed[0].reason.message
        : String(failed[0]?.reason || "Unknown error");

      if (succeeded === 0) {
        setAssignmentFeedback(`Assignment failed for all selected ${label}. Reason: ${firstReason}`);
        return;
      }

      setAssignmentFeedback(
        `${mode === "assign" ? "Assigned" : "Unassigned"} ${succeeded} ${label}, but ${failed.length} failed. First error: ${firstReason}`
      );
    } catch (error: any) {
      setAssignmentFeedback(error?.message || "Assignment update failed. Please try again.");
    } finally {
      setAssignmentActionKey(null);
    }
  };

  const assignAdminToProductStatus = async (productStatusId: string) => {
    const assignedAdminId = Number(assignmentSelections[productStatusId] || 0);
    if (!assignedAdminId) return;
    setAssigningOrderId(productStatusId);
    try {
      await chatService.assignProductStatusAdmin(productStatusId, assignedAdminId);
      await loadAssignments();
    } catch {
      setAssignmentFeedback("Assignment update failed. Please try again.");
    } finally {
      setAssigningOrderId(null);
    }
  };

  const sendNotification = async () => {
    if (!formMessage.trim()) return;
    if (composeMode === "notification" && !formTitle.trim()) return;
    if (composeMode === "notification" && formType === "custom" && !customType.trim()) return;
    setSending(true);
    try {
      if (composeMode === "chat") {
        if (isSuperAdmin && !globalChatsAdminId) {
          throw new Error("Assign an admin for all chats before sending chat messages.");
        }
        const recipientIds = targetUser
          ? [targetUser.id]
          : selectedIds.size > 0
            ? Array.from(selectedIds)
            : [];

        if (recipientIds.length === 0) {
          throw new Error("Select one or more users to send chat messages.");
        }

        await Promise.all(
          recipientIds.map((receiverId) =>
            chatService.sendMessage({
              receiverId,
              type: "text",
              text: formMessage.trim(),
              ...(isSuperAdmin && globalChatsAdminId ? { assignedAdminId: globalChatsAdminId } : {}),
            })
          )
        );
        await fetch("/api/notifications/chat-history", {
          method: "POST",
          headers: hdrs(),
          body: JSON.stringify({
            user_ids: recipientIds,
            message: formMessage.trim(),
            ...(isSuperAdmin && globalChatsAdminId ? { sender_admin_id: globalChatsAdminId } : {}),
          }),
        }).catch(() => {});
        loadHistory();

        setSent(`Chat sent to ${recipientIds.length} user${recipientIds.length !== 1 ? "s" : ""}`);
        setFormTitle("");
        setFormMessage("");
        setSelectedIds(new Set());
        setTimeout(() => { setShowForm(false); setSent(null); }, 2000);
        return;
      }

      const body: any = {
        title: formTitle.trim(),
        message: formMessage.trim(),
        type: resolvedType,
        theme_color: activeThemeColor,
        theme_font_color: fontColor,
        theme_font_size: fontSize,
      };
      if (targetUser) {
        body.user_ids = [targetUser.id];
      } else if (selectedIds.size > 0) {
        body.user_ids = Array.from(selectedIds);
      } else {
        body.user_group = sendToGroup;
      }
      const r = await fetch("/api/notifications/send", { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) {
        setSent(`Sent to ${d.sent_to} user${d.sent_to !== 1 ? "s" : ""}`);
        setFormTitle(""); setFormMessage("");
        setSelectedIds(new Set());
        setTimeout(() => { setShowForm(false); setSent(null); }, 2000);
      }
    } catch { } finally { setSending(false); }
  };

  const filteredHistory = useMemo(() => {
    let list = historyMode === "notifications" ? history : chatHistory;
    if (historyGroup !== "all") {
      list = list.filter(n => {
        const types = Array.isArray(n.recipient_user_types) ? n.recipient_user_types : [n.user_type];
        return types.map((type: any) => String(type || "user").toLowerCase()).includes(historyGroup);
      });
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter(n => [
        n.title,
        n.message,
        n.username,
        n.full_name,
        n.sender_username,
        n.sender_full_name,
        n.is_bulk ? `${n.recipient_count || 0} users` : "",
      ].some(f => String(f || "").toLowerCase().includes(q)));
    }
    return list;
  }, [history, chatHistory, historyMode, historySearch, historyGroup]);

  const isSuperAdmin = useMemo(() => {
    const normalized = String(currentUserType || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    return normalized === "superadmin" || normalized === "super_admin";
  }, [currentUserType]);

  const assignedAdminIds = useMemo(() => {
    return Array.from(new Set(
      [...assignments, ...topupAssignments].map((assignment: any) => Number(assignment.assigned_admin_id || 0)).filter(Boolean)
    ));
  }, [assignments, topupAssignments]);

  const adminOnlyUsers = useMemo(() => {
    return users.filter((user) => String(user.user_type || "").trim().toLowerCase() === "admin");
  }, [users]);

  const filteredAdminUsers = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return adminOnlyUsers;
    return adminOnlyUsers.filter((user) =>
      [user.username, user.full_name, user.user_id].some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [adminOnlyUsers, adminSearch]);

  const filteredOrderRecords = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orderRecords;
    return orderRecords.filter((record) =>
      [
        record.order_number,
        record.buyer_name,
        record.buyer_username,
        record.seller_name,
        record.seller_username,
      ].some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [orderRecords, orderSearch]);

  const filteredTopupRecords = useMemo(() => {
    const q = topupSearch.trim().toLowerCase();
    if (!q) return topupRecords;
    return topupRecords.filter((record) =>
      [record.topup_request_id, record.username, record.full_name, record.status].some((value) =>
        String(value || "").toLowerCase().includes(q)
      )
    );
  }, [topupRecords, topupSearch]);

  const anyOrdersAssigned = useMemo(() => assignments.length > 0, [assignments]);
  const anyTopupsAssigned = useMemo(() => topupAssignments.length > 0, [topupAssignments]);
  const orderAdminLabel = useMemo(() => {
    const username = assignments[0]?.assigned_admin?.username;
    return username ? `@${username}` : "Not assigned";
  }, [assignments]);
  const topupAdminLabel = useMemo(() => {
    const username = topupAssignments[0]?.assigned_admin?.username;
    return username ? `@${username}` : "Not assigned";
  }, [topupAssignments]);
  const chatsAdminLabel = useMemo(() => {
    const selectedAdmin = adminOnlyUsers.find((admin) => Number(admin.id) === Number(globalChatsAdminId));
    if (!selectedAdmin) return "Not assigned";
    return `@${selectedAdmin.username}`;
  }, [adminOnlyUsers, globalChatsAdminId]);
  const chatSenderAdmin = useMemo(() => {
    return adminOnlyUsers.find((admin) => Number(admin.id) === Number(globalChatsAdminId)) || null;
  }, [adminOnlyUsers, globalChatsAdminId]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const ids = filteredUsers.map(u => u.id);
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.has(id));
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Chat & Notifications</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage notifications, assigned order chats, and delegated admin communication</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-2xl border border-white/10 overflow-hidden">
            {(["users", "history", "assignments"] as View[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all ${view === v ? "bg-white text-black" : "text-white/50 hover:text-white hover:bg-white/5"}`}
              >
                {v === "users" ? "Users" : v === "history" ? "History" : "Assigned Chats"}
              </button>
            ))}
          </div>
          {view === "users" && selectedIds.size > 0 && (
            <>
              <button
                onClick={openFormForSelected}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-500 transition"
              >
                <IonIcon name="notifications-outline" className="text-base" />
                Notify {selectedIds.size} selected
              </button>
              <button
                onClick={openChatForSelected}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500 transition"
              >
                <IonIcon name="chatbubble-ellipses-outline" className="text-base" />
                Chat {selectedIds.size} selected
              </button>
            </>
          )}
          {view === "assignments" && isSuperAdmin && assignedAdminIds.length > 0 && (
            <button
              onClick={openFormForAssignedAdmins}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-500 transition"
            >
              <IonIcon name="paper-plane-outline" className="text-base" />
              Notify Assigned Admins
            </button>
          )}
        </div>
      </div>

      {/* ── USERS VIEW ── */}
      {view === "users" && (
        <div className="space-y-4">
          {/* Group Tabs */}
          <div className="flex flex-wrap gap-2">
            {GROUP_TABS.map(g => (
              <button
                key={g.key}
                onClick={() => { setGroupTab(g.key); setSelectedIds(new Set()); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${groupTab === g.key ? g.color + " shadow-lg" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"}`}
              >
                {g.label}
                {groupCounts[g.key] !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${groupTab === g.key ? "bg-black/15" : "bg-white/10 text-white/50"}`}>
                    {groupCounts[g.key] || 0}
                  </span>
                )}
              </button>
            ))}
            {/* Send to current group button */}
            <button
              onClick={() => openFormForGroup(groupTab)}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-2xl bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-white/90 transition"
            >
              <IonIcon name="send-outline" className="text-base" />
              Send to {groupTab === "all" ? "All" : GROUP_TABS.find(g => g.key === groupTab)?.label}
            </button>
          </div>

          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] overflow-hidden">
            <div className="p-4 border-b border-white/5 flex flex-wrap gap-3 items-center">
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by name, username or ID..."
                className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none flex-1 min-w-[180px]"
              />
              <span className="text-white/30 text-xs">{filteredUsers.length} shown</span>
              {selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())} className="text-[10px] text-white/40 hover:text-white transition">
                  Clear {selectedIds.size} selected
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 w-10">
                      <button
                        onClick={selectAllVisible}
                        className="w-5 h-5 rounded border border-white/20 flex items-center justify-center hover:border-white/40 transition"
                        title="Select/deselect all visible"
                      >
                        {filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.has(u.id)) ? (
                          <div className="w-3 h-3 rounded-sm bg-white" />
                        ) : filteredUsers.some(u => selectedIds.has(u.id)) ? (
                          <div className="w-3 h-0.5 bg-white/50 rounded" />
                        ) : null}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-500">User</th>
                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-500">ID</th>
                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-500">Type</th>
                    <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-widest text-slate-500">Notify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredUsers.slice(0, 150).map(u => {
                    const avatar = resolveAvatar(u.profile_picture, u.full_name || u.username);
                    const isSelected = selectedIds.has(u.id);
                    return (
                      <tr
                        key={u.id}
                        onClick={() => toggleSelect(u.id)}
                        className={`transition-colors cursor-pointer ${isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
                      >
                        <td className="px-4 py-3">
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? "border-white bg-white" : "border-white/20"}`}>
                            {isSelected && <IonIcon name="checkmark" className="text-black text-xs" />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/10 bg-white/5">
                              <Image unoptimized src={avatar} alt={u.full_name || u.username} fill sizes="32px" className="object-cover" />
                            </div>
                            <div>
                              <p className="text-white text-xs font-bold">{u.user_type?.toLowerCase() === 'admin' ? `@${u.username}` : (u.full_name || u.username)}</p>
                              <p className="text-white/35 text-[10px]">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/45 text-[10px] font-mono">
                          {String(u.user_id || u.id).padStart(6, "0")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            (u.user_type || "user").toLowerCase() === "seller" ? "bg-emerald-500/10 text-emerald-400" :
                            (u.user_type || "user").toLowerCase() === "employee" ? "bg-amber-500/10 text-amber-400" :
                            (u.user_type || "user").toLowerCase() === "admin" ? "bg-purple-500/10 text-purple-400" :
                            "bg-blue-500/10 text-blue-400"
                          }`}>
                            {u.user_type || "user"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => openFormForUser(u)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition"
                            title="Send notification to this user"
                          >
                            <IonIcon name="notifications-outline" className="text-sm" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500 text-sm">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === "history" && (
        <div className="space-y-4">
          {/* Group filter */}
          <div className="flex flex-wrap gap-2">
            {GROUP_TABS.map(g => (
              <button
                key={g.key}
                onClick={() => setHistoryGroup(g.key)}
                className={`px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${historyGroup === g.key ? g.color : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"}`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] overflow-hidden">
            <div className="p-4 border-b border-white/5 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-white/50 text-sm font-bold">
                  {filteredHistory.length} {historyMode === "notifications" ? "notifications" : "chat sends"}
                </span>
                <div className="flex rounded-xl border border-white/10 overflow-hidden">
                  {(["notifications", "chats"] as HistoryMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setHistoryMode(mode)}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${historyMode === mode ? "bg-white text-black" : "bg-white/[0.03] text-white/45 hover:text-white"}`}
                    >
                      {mode === "notifications" ? "Notification History" : "Chat History"}
                    </button>
                  ))}
                </div>
              </div>
              <input
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search history..."
                className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none w-56"
              />
            </div>

            {historyLoading ? (
              <div className="p-16 text-center text-slate-500 text-sm">Loading...</div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-16 text-center text-slate-500 text-sm">
                No {historyMode === "notifications" ? "notifications" : "chat messages"} sent yet.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {filteredHistory.map(n => {
                  const grad = n.theme_color || null;
                  return (
                    <div key={n.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-start gap-3">
                      {/* Theme color swatch */}
                      <div
                        className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
                        style={{ background: grad || "rgba(255,255,255,0.05)" }}
                      >
                        <IonIcon name={historyMode === "notifications" ? "notifications-outline" : "chatbubble-ellipses-outline"} className="text-white text-base" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-white text-xs font-black">{historyMode === "notifications" ? n.title : "Chat Message"}</p>
                          {historyMode === "notifications" ? (
                            <>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                n.type === "info" ? "bg-blue-500/10 text-blue-400" :
                                n.type === "success" ? "bg-emerald-500/10 text-emerald-400" :
                                n.type === "warning" ? "bg-amber-500/10 text-amber-400" :
                                "bg-purple-500/10 text-purple-400"
                              }`}>{n.type}</span>
                              <span className={`text-[9px] font-bold ${n.is_read ? "text-emerald-400" : "text-white/30"}`}>
                                {n.is_read ? "Read" : "Unread"}
                              </span>
                            </>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                              Chat
                            </span>
                          )}
                          <span className="text-white/25 text-[9px] ml-auto">{timeAgo(n.created_at)}</span>
                        </div>
                        <p className="text-white/50 text-[10px] mb-1 leading-relaxed">{n.message}</p>
                        {n.is_bulk ? (
                          <p className="text-white/30 text-[9px]">
                            Bulk {historyMode === "notifications" ? "notification" : "chat"}:{" "}
                            <span className="text-white/60 font-bold">
                              {Number(n.recipient_count || 0)} user{Number(n.recipient_count || 0) === 1 ? "" : "s"}
                            </span>
                            {historyMode === "chats" && (n.sender_full_name || n.sender_username) && (
                              <span className="text-white/25"> from @{n.sender_username || n.sender_full_name}</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-white/30 text-[9px]">
                            To: <span className="text-white/50 font-bold">{n.full_name || n.username || "—"}</span>
                            {n.username && <span className="text-white/25"> @{n.username}</span>}
                            {historyMode === "chats" && (n.sender_full_name || n.sender_username) && (
                              <span className="text-white/25"> from @{n.sender_username || n.sender_full_name}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "assignments" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#09090b] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Assigned Threads</p>
              <p className="mt-2 text-2xl font-black text-white">{assignments.length}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-[#09090b] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Assigned Admins</p>
              <p className="mt-2 text-2xl font-black text-white">{new Set(assignments.map((assignment) => assignment.assigned_admin_id).filter(Boolean)).size}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-[#09090b] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Role</p>
              <p className="mt-2 text-sm font-black uppercase tracking-widest text-blue-200">{isSuperAdmin ? "Super Admin" : "Admin View"}</p>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] overflow-hidden">
              <div className="p-4 border-b border-white/5 flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <span className="text-white/50 text-sm font-bold">Bulk Admin Assignment</span>
                  <p className="text-white/30 text-[11px] mt-1">Assign one Admin for all product-status orders, and separately assign another Admin for all top-up requests. Unassign separately too.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                    placeholder="Search admin..."
                    className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none w-72"
                  />
                </div>
              </div>
              <div className="p-4 space-y-4">
                {assignmentFeedback && (
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-[11px] font-bold text-blue-200">
                    {assignmentFeedback}
                  </div>
                )}
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 space-y-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-amber-200/60">All Chats</p>
                      <p className="mt-1 text-sm font-black text-white">{chatsAdminLabel}</p>
                    </div>
                    <select
                      value={bulkChatsAdminId || ""}
                      onChange={(event) => setBulkChatsAdminId(Number(event.target.value || 0))}
                      className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="">Select Admin</option>
                      {filteredAdminUsers.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          @{admin.username} {admin.full_name ? `(${admin.full_name})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={assignGlobalChatsAdmin}
                      disabled={assignmentActionKey === "assign-all" || !bulkChatsAdminId}
                      className="w-full rounded-2xl border border-amber-400/35 bg-amber-400/15 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-amber-200 transition hover:bg-amber-400/25 disabled:opacity-40"
                    >
                      {assignmentActionKey === "assign-all" ? "Assigning..." : "Assign All Chats"}
                    </button>
                    <button
                      onClick={unassignGlobalChatsAdmin}
                      disabled={assignmentActionKey === "unassign-all" || !globalChatsAdminId}
                      className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-40"
                    >
                      {assignmentActionKey === "unassign-all" ? "Unassigning..." : "Unassign All Chats"}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-4 space-y-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-200/60">Orders</p>
                      <p className="mt-1 text-sm font-black text-white">{orderAdminLabel}</p>
                    </div>
                    <select
                      value={bulkOrdersAdminId || ""}
                      onChange={(event) => setBulkOrdersAdminId(Number(event.target.value || 0))}
                      className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="">Select Admin</option>
                      {filteredAdminUsers.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          @{admin.username} {admin.full_name ? `(${admin.full_name})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => applyBulkAssignment("orders", "assign", bulkOrdersAdminId)}
                      disabled={assignmentActionKey === "assign-orders" || !bulkOrdersAdminId}
                      className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-40"
                    >
                      {assignmentActionKey === "assign-orders" ? "Assigning..." : "Assign All Orders"}
                    </button>
                    <button
                      onClick={() => applyBulkAssignment("orders", "unassign")}
                      disabled={assignmentActionKey === "unassign-orders" || !anyOrdersAssigned}
                      className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-40"
                    >
                      {assignmentActionKey === "unassign-orders" ? "Unassigning..." : "Unassign All Orders"}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 space-y-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-200/60">Top-Ups</p>
                      <p className="mt-1 text-sm font-black text-white">{topupAdminLabel}</p>
                    </div>
                    <select
                      value={bulkTopupsAdminId || ""}
                      onChange={(event) => setBulkTopupsAdminId(Number(event.target.value || 0))}
                      className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="">Select Admin</option>
                      {filteredAdminUsers.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          @{admin.username} {admin.full_name ? `(${admin.full_name})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => applyBulkAssignment("topups", "assign", bulkTopupsAdminId)}
                      disabled={assignmentActionKey === "assign-topups" || !bulkTopupsAdminId}
                      className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {assignmentActionKey === "assign-topups" ? "Assigning..." : "Assign All Top-Ups"}
                    </button>
                    <button
                      onClick={() => applyBulkAssignment("topups", "unassign")}
                      disabled={assignmentActionKey === "unassign-topups" || !anyTopupsAssigned}
                      className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-40"
                    >
                      {assignmentActionKey === "unassign-topups" ? "Unassigning..." : "Unassign All Top-Ups"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {false && isSuperAdmin && (
            <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] overflow-hidden">
              <div className="p-4 border-b border-white/5 flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <span className="text-white/50 text-sm font-bold">Assign One Admin Across Orders and Top-Ups</span>
                  <p className="text-white/30 text-[11px] mt-1">Search an Admin and assign or unassign that Admin across all order chats and all top-up request chats.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                    placeholder="Search admin..."
                    className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none w-72"
                  />
                  <select
                    value={bulkOrdersAdminId || ""}
                    onChange={(event) => setBulkOrdersAdminId(Number(event.target.value || 0))}
                    className="min-w-[260px] rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="">Select Admin</option>
                    {filteredAdminUsers.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        @{admin.username} {admin.full_name ? `(${admin.full_name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {orderRecordsLoading ? (
                <div className="p-16 text-center text-slate-500 text-sm">Loading product status records...</div>
              ) : filteredOrderRecords.length === 0 ? (
                <div className="p-16 text-center text-slate-500 text-sm">No product status records found.</div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {filteredOrderRecords.slice(0, 50).map((record) => (
                    <div key={record.product_status_id} className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-white text-xs font-black">Order #{record.order_number}</p>
                        <p className="mt-1 text-white/40 text-[10px]">
                          Buyer: <span className="text-white/70">{record.buyer_name}</span> @{record.buyer_username}
                          {" · "}
                          Seller: <span className="text-white/70">{record.seller_name}</span> @{record.seller_username}
                        </p>
                        {assignments.find((assignment) => assignment.product_status_id === record.product_status_id)?.assigned_admin && (
                          <p className="mt-2 text-[10px] text-blue-300">
                            Current Admin: @{assignments.find((assignment) => assignment.product_status_id === record.product_status_id)?.assigned_admin?.username}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={assignmentSelections[record.product_status_id] || ""}
                          onChange={(event) => setAssignmentSelections((prev) => ({
                            ...prev,
                            [record.product_status_id]: Number(event.target.value || 0),
                          }))}
                          className="min-w-[220px] rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-xs text-white outline-none"
                        >
                          <option value="">Select Admin</option>
                          {adminOnlyUsers.map((admin) => (
                            <option key={admin.id} value={admin.id}>
                              @{admin.username} {admin.full_name ? `(${admin.full_name})` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => assignAdminToProductStatus(record.product_status_id)}
                          disabled={!assignmentSelections[record.product_status_id] || assigningOrderId === record.product_status_id}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-40"
                        >
                          {assigningOrderId === record.product_status_id ? "Saving..." : "Assign Admin"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !sending && setShowForm(false)} />
          <div className="relative w-full max-w-md rounded-[1.25rem] border border-white/10 bg-[#111113] shadow-2xl overflow-hidden">

            {/* Gradient preview banner */}
            <div
              className="h-20 w-full transition-all duration-500 relative"
              style={{ background: activeThemeColor }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_35%)]" />
              <div className="absolute inset-0 flex items-end gap-2.5 p-4 bg-gradient-to-t from-black/70 via-black/15 to-transparent">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/18 text-white shadow-lg shadow-black/20 backdrop-blur">
                  <IonIcon name={composeMode === "chat" ? "chatbubble-ellipses" : "notifications"} className="text-base" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black truncate" style={{ color: fontColor, fontSize: previewTitleSize }}>
                    {composeMode === "chat" ? "Chat message" : (formTitle || "Notification title...")}
                  </p>
                  <p className="truncate font-semibold opacity-80" style={{ color: fontColor, fontSize: previewMessageSize }}>
                    {formMessage || (composeMode === "chat" ? "Chat message preview..." : "Message preview...")}
                  </p>
                </div>
              </div>
              <div className="hidden">
                <p className="text-white font-black text-sm truncate">{formTitle || "Notification title…"}</p>
                <p className="text-white/70 text-[10px] truncate">{formMessage || "Message preview…"}</p>
              </div>
            </div>

            <div className="max-h-[calc(100vh-7rem)] overflow-y-auto p-4 space-y-3 custom-scrollbar">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">
                  {targetUser
                    ? `Sending to @${targetUser.username}`
                    : selectedIds.size > 0
                    ? `Sending to ${selectedIds.size} selected user${selectedIds.size !== 1 ? "s" : ""}`
                    : `Sending to all ${GROUP_TABS.find(g => g.key === sendToGroup)?.label || "Users"} (${groupCounts[sendToGroup] || 0})`}
                </p>
              </div>

              {sent ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <IonIcon name="checkmark-circle" className="text-2xl text-emerald-400" />
                  </div>
                  <p className="text-white/70 text-sm font-bold">{sent}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-1">
                    <button
                      type="button"
                      onClick={() => setComposeMode("notification")}
                      className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${composeMode === "notification" ? "bg-white text-black" : "text-white/45 hover:bg-white/10 hover:text-white"}`}
                    >
                      Notification
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposeMode("chat")}
                      disabled={!targetUser && selectedIds.size === 0}
                      className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${composeMode === "chat" ? "bg-white text-black" : "text-white/45 hover:bg-white/10 hover:text-white"} disabled:opacity-40`}
                    >
                      Chat
                    </button>
                  </div>

                  {composeMode === "chat" && isSuperAdmin && (
                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5">
                      <p className="text-[8px] font-black uppercase tracking-widest text-amber-200/60">Assigned Chat Admin</p>
                      <p className="mt-1 text-xs font-black text-white">
                        {chatSenderAdmin
                          ? `@${chatSenderAdmin.username}${chatSenderAdmin.full_name ? ` (${chatSenderAdmin.full_name})` : ""}`
                          : "No admin assigned for all chats"}
                      </p>
                    </div>
                  )}

                  {/* Title */}
                  {composeMode === "notification" && (
                    <input
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      placeholder="Notification title"
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/25 outline-none focus:border-white/25 transition"
                    />
                  )}

                  {/* Message */}
                  <textarea
                    value={formMessage}
                    onChange={e => setFormMessage(e.target.value)}
                    placeholder={composeMode === "chat" ? "Type chat message…" : "Message…"}
                    rows={2}
                    className="w-full resize-none bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/25 outline-none focus:border-white/25 transition"
                  />

                  {/* Type */}
                  {composeMode === "notification" && (
                    <>
                      <select
                        value={formType}
                        onChange={e => setFormType(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                      >
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="warning">Warning</option>
                        <option value="promo_code">Promo</option>
                        <option value="custom">Custom</option>
                      </select>
                      {formType === "custom" && (
                        <input
                          value={customType}
                          onChange={e => setCustomType(e.target.value)}
                          placeholder="Type custom notification type"
                          className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/25 outline-none focus:border-white/25 transition"
                        />
                      )}
                    </>
                  )}

                  {composeMode === "notification" && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-1.5">Font Size</p>
                      <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">
                        {[
                          { key: "small", label: "Small" },
                          { key: "normal", label: "Normal" },
                          { key: "large", label: "Large" },
                        ].map(option => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setFontSize(option.key)}
                            className={`rounded-lg px-1.5 py-1.5 text-[8px] font-black uppercase tracking-wide transition ${fontSize === option.key ? "bg-white text-black" : "text-white/45 hover:bg-white/10 hover:text-white"}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-1.5">Font Color</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={fontColor}
                          onChange={e => setFontColor(e.target.value)}
                          className="h-8 w-10 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                        />
                        <div className="min-w-0">
                          <p className="text-[10px] font-black" style={{ color: fontColor }}>Preview text</p>
                          <p className="text-[9px] font-mono text-white/35">{fontColor}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Gradient Theme Picker */}
                  {composeMode === "notification" && (
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-1.5">Theme Color</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {GRADIENT_PRESETS.map(preset => (
                        <button
                          key={preset.label}
                          onClick={() => setGradientPreset(preset)}
                          title={preset.label}
                          className={`relative h-8 rounded-lg overflow-hidden border transition-all ${gradientPreset.label === preset.label ? "border-white scale-105 shadow-lg" : "border-transparent hover:border-white/30"}`}
                          style={{ background: preset.value === "custom" ? `linear-gradient(135deg,${customFrom},${customTo})` : preset.value }}
                        >
                          <span className="absolute inset-0 flex items-end justify-center pb-1">
                            <span className="text-[6px] font-black text-white/80 uppercase tracking-wide drop-shadow">{preset.label}</span>
                          </span>
                          {gradientPreset.label === preset.label && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center">
                              <IonIcon name="checkmark" className="text-black text-[8px]" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Custom color pickers */}
                    {gradientPreset.value === "custom" && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <label className="text-[8px] font-black uppercase tracking-widest text-white/30 shrink-0">From</label>
                          <input
                            type="color"
                            value={customFrom}
                            onChange={e => setCustomFrom(e.target.value)}
                            className="w-8 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                          />
                          <span className="text-white/40 text-[9px] font-mono">{customFrom}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1">
                          <label className="text-[8px] font-black uppercase tracking-widest text-white/30 shrink-0">To</label>
                          <input
                            type="color"
                            value={customTo}
                            onChange={e => setCustomTo(e.target.value)}
                            className="w-8 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                          />
                          <span className="text-white/40 text-[9px] font-mono">{customTo}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowForm(false)}
                      disabled={sending}
                      className="flex-1 rounded-xl border border-white/10 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:bg-white/5 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendNotification}
                      disabled={
                        sending
                        || !formMessage.trim()
                        || (composeMode === "chat" && isSuperAdmin && !globalChatsAdminId)
                        || (composeMode === "notification" && !formTitle.trim())
                        || (composeMode === "notification" && formType === "custom" && !customType.trim())
                      }
                      className="flex-1 rounded-xl py-2.5 text-[10px] font-bold uppercase tracking-widest text-white transition disabled:opacity-40"
                      style={{ background: activeThemeColor }}
                    >
                      {sending ? "Sending…" : composeMode === "chat" ? "Send Chat" : "Send"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
