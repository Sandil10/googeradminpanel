"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import { chatService } from "@/services/chatService";
import { authService } from "@/services/authService";

interface OrderRecord {
    id: number;
    item_id: number;
    buyer_id: number;
    seller_id: number;
    status: string;
    quantity?: number;
    size?: string | null;
    color?: string | null;
    variant_index?: number | null;
    total_price?: string | number;
    shipping_address?: string | null;
    order_number?: string | null;
    wallet_transfer_id?: string | number | null;
    payment_method?: string | null;
    shipping_fee?: string | number | null;
    report_status?: string | null;
    report_by?: string | null;
    buyer_report?: string | Record<string, unknown> | null;
    seller_report?: string | Record<string, unknown> | null;
    created_at?: string;
    updated_at?: string;
    title?: string;
    image_url?: string | null;
    category?: string | null;
    listed_price?: string | number | null;
    promo_price?: string | number | null;
    buyer_username?: string | null;
    buyer_name?: string | null;
    buyer_googer_id?: string | number | null;
    buyer_profile_picture?: string | null;
    seller_username?: string | null;
    seller_name?: string | null;
    seller_googer_id?: string | number | null;
    seller_profile_picture?: string | null;
}

interface OrderGroup {
    key: string;
    orderNumber: string;
    items: OrderRecord[];
    buyer: {
        id: number;
        name: string;
        username: string;
        googerId: string;
        profilePicture: string | null;
    };
    seller: {
        id: number;
        name: string;
        username: string;
        googerId: string;
        profilePicture: string | null;
    };
    createdAt?: string;
    updatedAt?: string;
}

interface ConfirmDialog {
    open: boolean;
    orderId: number | null;
    nextStatus: "cancelled" | "received" | "";
    title: string;
    message: string;
}

interface ChatSidebarState {
    isOpen: boolean;
    participant: {
        id: number;
        name: string;
        username: string;
        profile_picture: string | null;
        roleLabel: string;
    } | null;
    contextLabel: string | null;
    orderNumber: string | null;
    assignedAdminId: number | null;
}

interface ProductStatusAssignment {
    product_status_id: string;
    assigned_admin_id: number;
    assigned_admin: {
        id: number;
        name: string;
        username: string | null;
        profile_picture: string | null;
    };
    buyer?: {
        id: number | null;
        name: string;
        username: string | null;
    };
    seller?: {
        id: number | null;
        name: string;
        username: string | null;
    };
    updated_at?: string;
}

interface AdminCandidate {
    id: number;
    username: string;
    full_name?: string | null;
    email?: string | null;
    user_type?: string | null;
    profile_picture?: string | null;
}

interface ChatMessage {
    id: number;
    sender_id: number;
    receiver_id: number;
    type: "text" | "image";
    text?: string | null;
    image_url?: string | null;
    file_name?: string | null;
    status?: string;
    created_at?: string;
}

interface ProductImagePreview {
    src: string;
    title: string;
}

const PRODUCT_ASSIGNMENTS_CACHE_KEY = "googer_product_status_assignments_cache";

const stripChatColorTags = (value?: string | null) =>
    String(value || "").replace(/\[c=#[0-9a-fA-F]{3,8}\]([\s\S]*?)\[\/c\]/g, "$1");

type StageTabKey = "all" | "processing" | "shipped" | "delivered" | "returns";
const ORDERS_PER_PAGE = 5;

const ORDER_STAGE_FILTERS: Record<StageTabKey, string[]> = {
    all: ["pending", "processing", "shipped", "delivered", "received", "reshipped", "cancelled", "returned", "rejected"],
    processing: ["processing"],
    shipped: ["shipped"],
    delivered: ["delivered", "received", "reshipped", "rejected"],
    returns: ["returned"],
};

const STAGE_TABS: Array<{ key: StageTabKey; label: string; icon: string }> = [
    { key: "all", label: "All Orders", icon: "albums-outline" },
    { key: "processing", label: "Processing", icon: "sync-outline" },
    { key: "shipped", label: "Shipped", icon: "car-outline" },
    { key: "delivered", label: "Delivered", icon: "checkmark-circle-outline" },
    { key: "returns", label: "Returns", icon: "refresh-circle-outline" },
];

const PAYMENT_LABELS: Record<string, string> = {
    wallet: "Googer Payment",
    wallet_manual: "Googer Manual Payment",
    cod: "Cash on Delivery",
};

const PROGRESS_STEPS = ["pending", "processing", "shipped", "delivered", "received"];

const normalizeStatus = (value?: string) => String(value || "pending").toLowerCase();

const formatCurrency = (value: string | number | null | undefined) => {
    const numeric = Number(value || 0);
    return `R ${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getOrderTotal = (items: OrderRecord[]) => {
    return items.reduce((sum, item) => {
        return sum + Number(item.total_price || 0) + Number(item.shipping_fee || 0);
    }, 0);
};

const formatDateTime = (value?: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
};

const getShortDate = (value?: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const parseShippingAddress = (raw: any) => {
    if (!raw || raw === "null") return null;
    if (typeof raw === "object") return raw;

    try {
        return JSON.parse(raw);
    } catch {
        return { fullAddress: raw, addressMode: "single" };
    }
};

const getShippingSummary = (raw: any) => {
    const address = parseShippingAddress(raw);
    if (!address) return "No delivery address";

    if (address.addressMode === "single") {
        return address.fullAddress || "No delivery address";
    }

    return [
        address.houseNo,
        address.buildingNo,
        address.street,
        address.city,
        address.district,
        address.province,
        address.country,
    ].filter(Boolean).join(", ") || "No delivery address";
};

const getShippingBoxLines = (raw: any, buyerName?: string | null) => {
    const address = parseShippingAddress(raw);
    if (!address) return buyerName ? [buyerName] : ["No delivery address"];

    if (address.addressMode === "single") {
        return [buyerName || "Delivery", address.fullAddress || "No delivery address"].filter(Boolean);
    }

    const lines = [
        buyerName || address.fullName || address.name || "Delivery",
        [address.phone, address.mobile].filter(Boolean).join(" / "),
        [
            address.houseNo,
            address.buildingNo,
            address.street,
            address.city,
            address.district,
            address.province,
            address.country,
        ].filter(Boolean).join(", "),
    ].filter((line) => Boolean(String(line || "").trim()));

    return lines.length > 0 ? lines : ["No delivery address"];
};

const getStatusTone = (status?: string) => {
    const normalized = normalizeStatus(status);
    if (normalized === "received") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    if (normalized === "delivered") return "border-sky-500/20 bg-sky-500/10 text-sky-300";
    if (normalized === "processing") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    if (normalized === "shipped") return "border-violet-500/20 bg-violet-500/10 text-violet-300";
    if (normalized === "cancelled") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    if (normalized === "returned" || normalized === "rejected") return "border-orange-500/20 bg-orange-500/10 text-orange-300";
    return "border-white/10 bg-white/[0.05] text-white/75";
};

const getProgressStatus = (items: OrderRecord[]) => {
    const statuses = items.map((item) => normalizeStatus(item.status));
    if (statuses.every((status) => status === "cancelled")) return "cancelled";
    if (statuses.some((status) => status === "received")) return "received";
    if (statuses.some((status) => status === "delivered" || status === "reshipped" || status === "rejected")) return "delivered";
    if (statuses.some((status) => status === "shipped")) return "shipped";
    if (statuses.some((status) => status === "processing")) return "processing";
    if (statuses.some((status) => status === "returned")) return "returned";
    return "pending";
};

const getUniqueStatuses = (items: OrderRecord[]) => Array.from(new Set(items.map((item) => normalizeStatus(item.status))));

const getOrderCount = (groups: OrderGroup[]) => groups.length;

const groupOrders = (orders: OrderRecord[]) => {
    const groups = new Map<string, OrderGroup>();

    for (const order of orders) {
        const groupKey = order.order_number || `order-item-${order.id}`;
        const existing = groups.get(groupKey);

        if (existing) {
            existing.items.push(order);
            if (order.created_at && (!existing.createdAt || new Date(order.created_at) < new Date(existing.createdAt))) {
                existing.createdAt = order.created_at;
            }
            if (order.updated_at && (!existing.updatedAt || new Date(order.updated_at) > new Date(existing.updatedAt))) {
                existing.updatedAt = order.updated_at;
            }
            continue;
        }

        groups.set(groupKey, {
            key: groupKey,
            orderNumber: order.order_number || String(order.id),
            items: [order],
            buyer: {
                id: order.buyer_id,
                name: order.buyer_name || order.buyer_username || "Buyer",
                username: order.buyer_username || "-",
                googerId: String(order.buyer_googer_id || order.buyer_id || "-"),
                profilePicture: order.buyer_profile_picture || null,
            },
            seller: {
                id: order.seller_id,
                name: order.seller_name || order.seller_username || "Seller",
                username: order.seller_username || "-",
                googerId: String(order.seller_googer_id || order.seller_id || "-"),
                profilePicture: order.seller_profile_picture || null,
            },
            createdAt: order.created_at,
            updatedAt: order.updated_at,
        });
    }

    return Array.from(groups.values()).sort((a, b) => {
        const left = new Date(b.createdAt || 0).getTime();
        const right = new Date(a.createdAt || 0).getTime();
        return left - right;
    });
};

const filterGroupsByTab = (groups: OrderGroup[], activeTab: StageTabKey) => {
    const allowedStatuses = ORDER_STAGE_FILTERS[activeTab];
    return groups.filter((group) => group.items.some((item) => allowedStatuses.includes(normalizeStatus(item.status))));
};

const getGroupedCounts = (groups: OrderGroup[]) => ({
    all: getOrderCount(filterGroupsByTab(groups, "all")),
    processing: getOrderCount(filterGroupsByTab(groups, "processing")),
    shipped: getOrderCount(filterGroupsByTab(groups, "shipped")),
    delivered: getOrderCount(filterGroupsByTab(groups, "delivered")),
    returns: getOrderCount(filterGroupsByTab(groups, "returns")),
});

const canMarkAsReceived = (item: OrderRecord) => normalizeStatus(item.status) === "delivered";
const canCancelOrder = (item: OrderRecord) => {
    const status = normalizeStatus(item.status);
    return status !== "cancelled" && status !== "received";
};

const parseOrderReport = (raw: OrderRecord["buyer_report"] | OrderRecord["seller_report"]) => {
    if (!raw) return null;
    if (typeof raw === "object") return raw as Record<string, unknown>;

    try {
        return JSON.parse(raw);
    } catch {
        return { reason: String(raw) };
    }
};

const getOrderReportStatusTag = (item?: OrderRecord | null) => {
    if (!item?.buyer_report && !item?.seller_report) return null;

    const status = String(item.report_status || "").toLowerCase();

    if (status === "accepted") {
        return { label: "Accepted", tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300", icon: "checkmark-circle-outline" };
    }
    if (status === "rejected") {
        return { label: "Rejected", tone: "border-rose-500/20 bg-rose-500/10 text-rose-300", icon: "close-circle-outline" };
    }
    if (status === "reshipped") {
        return { label: "Pending", tone: "border-amber-500/20 bg-amber-500/10 text-amber-300", icon: "time-outline" };
    }

    return { label: "Pending", tone: "border-amber-500/20 bg-amber-500/10 text-amber-300", icon: "time-outline" };
};

const getReportReason = (entry: Record<string, unknown> | null) => {
    const reason = entry?.reason;
    return typeof reason === "string" && reason.trim() ? reason.trim() : "No reason provided";
};

const getReportTime = (entry: Record<string, unknown> | null) => {
    const value = entry?.timestamp;
    return typeof value === "string" && value.trim() ? getShortDate(value) : "-";
};

const decodeCurrentUserId = () => {
    if (typeof window === "undefined") return null;

    try {
        const token = window.localStorage.getItem("token");
        if (!token) return null;
        const payload = token.split(".")[1];
        if (!payload) return null;
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const parsed = JSON.parse(window.atob(normalized));
        return Number(parsed?.id || parsed?.userId || parsed?.sub || null) || null;
    } catch {
        return null;
    }
};

export default function ProductStatusTable() {
    const pathname = usePathname();
    const messageEndRef = useRef<HTMLDivElement | null>(null);
    const pollingRef = useRef<number | null>(null);

    const [orders, setOrders] = useState<OrderRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<StageTabKey>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
        open: false,
        orderId: null,
        nextStatus: "",
        title: "",
        message: "",
    });
    const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
    const [chatSidebar, setChatSidebar] = useState<ChatSidebarState>({
        isOpen: false,
        participant: null,
        contextLabel: null,
        orderNumber: null,
        assignedAdminId: null,
    });
    const [viewingOrderGroup, setViewingOrderGroup] = useState<OrderRecord[] | null>(null);
    const [productImagePreview, setProductImagePreview] = useState<ProductImagePreview | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatMessageInput, setChatMessageInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatSending, setChatSending] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [currentUserName, setCurrentUserName] = useState("Admin");
    const [currentUserType, setCurrentUserType] = useState<string>("");
    const [assignments, setAssignments] = useState<Record<string, ProductStatusAssignment>>({});
    const [adminCandidates, setAdminCandidates] = useState<AdminCandidate[]>([]);
    const [assignmentModalOrder, setAssignmentModalOrder] = useState<OrderGroup | null>(null);
    const [assignmentSearch, setAssignmentSearch] = useState("");
    const [assigningAdminId, setAssigningAdminId] = useState<number | null>(null);
    const [assignmentError, setAssignmentError] = useState<string | null>(null);
    // keyed by "participantId:orderNumber" → unread count from that user since admin last opened
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const unreadPollingRef = useRef<number | null>(null);
    const lastSeenMsgIdRef = useRef<Record<string, number>>({});

    const loadOrders = async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const data = await adminService.fetchAllOrders();
            setOrders(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err: any) {
            console.error(err);
            if (!isPolling) setError(err.message || "Failed to load orders");
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    const loadAssignments = async () => {
        try {
            const rows = await chatService.listAssignedProductStatusChats();
            const next: Record<string, ProductStatusAssignment> = {};
            (Array.isArray(rows) ? rows : []).forEach((row: any) => {
                if (row?.product_status_id) {
                    next[String(row.product_status_id)] = row;
                }
            });
            setAssignments(next);
            window.localStorage.setItem(PRODUCT_ASSIGNMENTS_CACHE_KEY, JSON.stringify(next));
        } catch (err) {
            console.error("Failed to load product-status assignments", err);
            try {
                const cached = JSON.parse(window.localStorage.getItem(PRODUCT_ASSIGNMENTS_CACHE_KEY) || "{}");
                if (cached && typeof cached === "object") {
                    setAssignments(cached);
                }
            } catch {}
        }
    };

    const loadAdminCandidates = async () => {
        try {
            const users = await adminService.fetchAllUsers();
            const next = (Array.isArray(users) ? users : []).filter((user: any) => {
                const type = String(user?.user_type || "").trim().toLowerCase();
                return type === "admin";
            });
            setAdminCandidates(next);
        } catch (err) {
            console.error("Failed to load admin candidates", err);
        }
    };

    useEffect(() => {
        setCurrentUserId(decodeCurrentUserId());
        const storedUser = (() => {
            try {
                return JSON.parse(window.localStorage.getItem("user") || "null");
            } catch {
                return null;
            }
        })();
        const storedName = storedUser?.full_name || storedUser?.username || storedUser?.user_id;
        if (storedName) setCurrentUserName(String(storedName));
        if (storedUser?.user_type) setCurrentUserType(String(storedUser.user_type));
        authService.getProfile()
            .then((profile) => {
                const profileName = profile?.full_name || profile?.username || profile?.user_id;
                if (profileName) setCurrentUserName(String(profileName));
                if (profile?.user_type) setCurrentUserType(String(profile.user_type));
            })
            .catch(() => {});
        loadOrders(false);
        loadAssignments();
        loadAdminCandidates();
        const interval = window.setInterval(() => loadOrders(true), 30000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        const uid = decodeCurrentUserId();
        if (!uid) return;

        const checkUnread = async () => {
            const allGroups = groupOrders(orders);
            // Build unique list of (participantId, orderNumber) pairs
            const pairs: Array<{ pid: number; orderNumber: string; assignedAdminId: number | null }> = [];
            const seen = new Set<string>();
            for (const g of allGroups) {
                const assignedAdminId = assignments[g.orderNumber]?.assigned_admin_id
                    ? Number(assignments[g.orderNumber].assigned_admin_id)
                    : null;
                for (const pid of [g.buyer.id, g.seller.id]) {
                    const key = `${pid}:${g.orderNumber}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        pairs.push({ pid, orderNumber: g.orderNumber, assignedAdminId });
                    }
                }
            }

            const msgsByPair: Record<string, ChatMessage[]> = {};
            await Promise.all(
                pairs.map(async ({ pid, orderNumber, assignedAdminId }) => {
                    const pairKey = `${pid}:${orderNumber}`;
                    try {
                        const msgs = await chatService.getMessages(pid, false, orderNumber, null, assignedAdminId);
                        msgsByPair[pairKey] = Array.isArray(msgs) ? msgs : [];
                    } catch {
                        msgsByPair[pairKey] = [];
                    }
                })
            );

            const newCounts: Record<string, number> = {};
            for (const { pid, orderNumber } of pairs) {
                const key = `${pid}:${orderNumber}`;
                const msgs = msgsByPair[key] || [];
                const lastSeenId = lastSeenMsgIdRef.current[key] ?? -1;
                // Count messages from the participant (not admin) that arrived after lastSeen
                const count = msgs.filter(
                    (m) => String(m.sender_id) !== String(uid) && Number(m.id) > lastSeenId
                ).length;
                newCounts[key] = count;
            }
            setUnreadCounts(newCounts);
        };

        checkUnread();
        unreadPollingRef.current = window.setInterval(checkUnread, 8000);
        return () => {
            if (unreadPollingRef.current) window.clearInterval(unreadPollingRef.current);
        };
    }, [orders, assignments]);

    const groupedOrders = useMemo(() => groupOrders(orders), [orders]);
    const counts = useMemo(() => getGroupedCounts(groupedOrders), [groupedOrders]);
    const isSuperAdmin = useMemo(() => {
        const normalized = String(currentUserType || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
        return normalized === "superadmin" || normalized === "super_admin";
    }, [currentUserType]);
    const currentUserDisplayName = isSuperAdmin ? "Googer Support" : currentUserName;
    const filteredAdminCandidates = useMemo(() => {
        const query = assignmentSearch.trim().toLowerCase();
        if (!query) return adminCandidates;
        return adminCandidates.filter((admin) =>
            [admin.full_name, admin.username, admin.email, admin.user_type]
                .map((value) => String(value || "").toLowerCase())
                .some((value) => value.includes(query))
        );
    }, [adminCandidates, assignmentSearch]);
    const visibleGroups = useMemo(() => {
        const baseGroups = filterGroupsByTab(groupedOrders, activeTab);
        const normalizedSearch = searchQuery.trim().toLowerCase();
        if (!normalizedSearch) return baseGroups;

        return baseGroups.filter((group) => {
            const itemTitles = group.items.map((item) => item.title || "");
            const haystack = [
                group.orderNumber,
                group.seller.name,
                group.seller.username,
                group.seller.googerId,
                group.buyer.name,
                group.buyer.username,
                group.buyer.googerId,
                ...itemTitles,
                ...group.items.map((item) => String(item.id || "")),
            ].map((value) => String(value || "").toLowerCase());

            return haystack.some((value) => value.includes(normalizedSearch));
        });
    }, [groupedOrders, activeTab, searchQuery]);
    const visibleItems = useMemo(
        () => visibleGroups
            .flatMap((group) => group.items.map((item) => ({ group, item })))
            .sort((left, right) => {
                const leftOrder = String(left.item.order_number || left.group.orderNumber || "");
                const rightOrder = String(right.item.order_number || right.group.orderNumber || "");

                if (leftOrder !== rightOrder) {
                    const leftTime = new Date(left.group.createdAt || left.item.created_at || 0).getTime();
                    const rightTime = new Date(right.group.createdAt || right.item.created_at || 0).getTime();
                    return rightTime - leftTime;
                }

                return Number(left.item.id || 0) - Number(right.item.id || 0);
            }),
        [visibleGroups]
    );
    const totalPages = Math.max(1, Math.ceil(visibleItems.length / ORDERS_PER_PAGE));
    const paginatedItems = useMemo(
        () => visibleItems.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE),
        [visibleItems, currentPage]
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery]);

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

    const fetchChatMessages = async (
        participantId: number,
        orderNumber: string | null,
        markSeen = false,
        isInitial = false,
        assignedAdminId: number | null = null
    ) => {
        if (isInitial) setChatLoading(true);
        try {
            await chatService.updatePresence(participantId, orderNumber);
            const messages = await chatService.getMessages(participantId, markSeen, orderNumber || undefined, null, assignedAdminId);
            const fetched: ChatMessage[] = Array.isArray(messages) ? messages : [];
            if (isInitial) {
                setChatMessages(fetched);
            } else {
                // Merge: keep optimistic messages, append truly new real ones
                setChatMessages((prev) => {
                    const fetchedIds = new Set(fetched.map((m) => m.id));
                    const optimistic = prev.filter((m) => !fetchedIds.has(m.id));
                    const merged = [...fetched, ...optimistic];
                    merged.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
                    return merged;
                });
            }
            // While chat is open, keep lastSeen updated so badge stays 0
            if (fetched.length > 0 && orderNumber) {
                const key = `${participantId}:${orderNumber}`;
                const maxId = Math.max(...fetched.map((m) => Number(m.id)));
                if (maxId > (lastSeenMsgIdRef.current[key] ?? 0)) {
                    lastSeenMsgIdRef.current[key] = maxId;
                    setUnreadCounts((prev) => ({ ...prev, [key]: 0 }));
                }
            }
            setChatError(null);
        } catch (err: any) {
            console.error(err);
            if (isInitial) setChatError(err.message || "Failed to load chat");
        } finally {
            if (isInitial) setChatLoading(false);
        }
    };

    const chatSidebarRef = useRef(chatSidebar);
    useEffect(() => { chatSidebarRef.current = chatSidebar; }, [chatSidebar]);

    useEffect(() => {
        if (!chatSidebar.isOpen || !chatSidebar.participant?.id) {
            if (pollingRef.current) {
                window.clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            return;
        }

        // Initial load is handled by openChat; just start polling here
        pollingRef.current = window.setInterval(() => {
            const sidebar = chatSidebarRef.current;
            if (sidebar.participant?.id) {
                fetchChatMessages(sidebar.participant.id, sidebar.orderNumber, false, false, sidebar.assignedAdminId);
            }
        }, 3000);

        return () => {
            if (pollingRef.current) {
                window.clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [chatSidebar.isOpen, chatSidebar.participant?.id]);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages, chatSidebar.isOpen]);

    const openConfirm = (item: OrderRecord, nextStatus: "cancelled" | "received") => {
        setConfirmDialog({
            open: true,
            orderId: item.id,
            nextStatus,
            title: nextStatus === "received" ? "Mark as Received" : "Cancel Order",
            message: nextStatus === "received"
                ? `This will mark item ${item.id} in order ${item.order_number || item.id} as received.`
                : `This will cancel item ${item.id} in order ${item.order_number || item.id} and apply the same refund and stock logic used by the user panel.`,
        });
    };

    const applyOrderStatusUpdate = async (orderId: number, nextStatus: "cancelled" | "received") => {
        setSavingOrderId(orderId);
        try {
            const updatedItem = await adminService.updateAdminOrderStatus(orderId, nextStatus);
            setOrders((prev) => prev.map((item) => Number(item.id) === Number(orderId) ? { ...item, ...updatedItem } : item));
            setError(null);
            setConfirmDialog((prev) => ({ ...prev, open: false }));
        } catch (err: any) {
            console.error(err);
            alert(err.message || "Failed to update order status");
        } finally {
            setSavingOrderId(null);
        }
    };

    const openChat = async (group: OrderGroup, side: "buyer" | "seller") => {
        const participant = side === "buyer"
            ? {
                id: group.buyer.id,
                name: group.buyer.name,
                username: group.buyer.username,
                profile_picture: group.buyer.profilePicture,
                roleLabel: "Buyer",
            }
            : {
                id: group.seller.id,
                name: group.seller.name,
                username: group.seller.username,
                profile_picture: group.seller.profilePicture,
                roleLabel: "Seller",
            };

        const orderNumber = group.orderNumber;
        const chatKey = `${participant.id}:${orderNumber}`;
        const assignedAdminId = assignments[orderNumber]?.assigned_admin_id
            ? Number(assignments[orderNumber].assigned_admin_id)
            : null;

        setChatSidebar({
            isOpen: true,
            participant,
            contextLabel: `Order #${orderNumber}`,
            orderNumber,
            assignedAdminId,
        });
        setChatMessageInput("");
        setChatMessages([]);
        setChatError(null);

        // Mark as seen — clear badge for this order+participant
        try {
            const msgs = await chatService.getMessages(participant.id, true, orderNumber, null, assignedAdminId);
            const fetched: ChatMessage[] = Array.isArray(msgs) ? msgs : [];
            setChatMessages(fetched);

            // Record last seen message ID so badge resets correctly
            if (fetched.length > 0) {
                lastSeenMsgIdRef.current[chatKey] = Math.max(...fetched.map((m) => Number(m.id)));
            } else {
                lastSeenMsgIdRef.current[chatKey] = 0;
            }
            setUnreadCounts((prev) => ({ ...prev, [chatKey]: 0 }));

            // If this is the very first message in this conversation, auto-send order intro
            if (fetched.length === 0) {
                try {
                    const introMsg = await chatService.sendMessage({
                        receiverId: participant.id,
                        type: "text",
                        text: `Order #${orderNumber}`,
                        productStatusId: orderNumber,
                        ...(assignedAdminId ? { assignedAdminId } : {}),
                    });
                    if (introMsg) {
                        setChatMessages([introMsg]);
                        lastSeenMsgIdRef.current[chatKey] = Number(introMsg.id);
                    }
                } catch {
                    // intro send failed silently — admin can still type
                }
            }
        } catch (err: any) {
            setChatError(err.message || "Failed to load chat");
        }
    };

    const closeChat = () => {
        setChatSidebar({ isOpen: false, participant: null, contextLabel: null, orderNumber: null, assignedAdminId: null });
        setChatMessages([]);
        setChatMessageInput("");
        setChatError(null);
    };

    const openAssignmentModal = (group: OrderGroup) => {
        setAssignmentModalOrder(group);
        setAssignmentSearch("");
        setAssigningAdminId(null);
        setAssignmentError(null);
    };

    const closeAssignmentModal = () => {
        if (assigningAdminId !== null) return;
        setAssignmentModalOrder(null);
        setAssignmentSearch("");
        setAssignmentError(null);
    };

    const assignAdminToOrder = async (adminId: number) => {
        if (!assignmentModalOrder?.orderNumber) return;
        setAssigningAdminId(adminId);
        setAssignmentError(null);
        try {
            await chatService.assignProductStatusAdmin(assignmentModalOrder.orderNumber, adminId);
            await loadAssignments();
            setAssignmentModalOrder(null);
        } catch (err: any) {
            console.error(err);
            setAssignmentError(err.message || "Failed to assign admin");
        } finally {
            setAssigningAdminId(null);
        }
    };

    const handleSendChatMessage = async () => {
        const trimmed = chatMessageInput.trim();
        const participantId = chatSidebar.participant?.id;
        const orderNumber = chatSidebar.orderNumber;
        const assignedAdminId = chatSidebar.assignedAdminId;
        if (!trimmed || !participantId) return;

        setChatSending(true);
        // Optimistic update
        const optimisticId = Date.now();
        const optimistic: ChatMessage = {
            id: optimisticId as any,
            sender_id: currentUserId ?? 0,
            receiver_id: participantId,
            type: "text",
            text: trimmed,
            created_at: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, optimistic]);
        setChatMessageInput("");

        try {
            const sentMessage = await chatService.sendMessage({
                receiverId: participantId,
                type: "text",
                text: trimmed,
                productStatusId: orderNumber || undefined,
                ...(assignedAdminId ? { assignedAdminId } : {}),
            });
            // Replace optimistic with real message
            setChatMessages((prev) =>
                prev.map((m) => (m.id === (optimisticId as any) ? sentMessage : m))
            );
            if (sentMessage && orderNumber) {
                const key = `${participantId}:${orderNumber}`;
                lastSeenMsgIdRef.current[key] = Math.max(
                    lastSeenMsgIdRef.current[key] ?? 0,
                    Number(sentMessage.id)
                );
                setUnreadCounts((prev) => ({ ...prev, [key]: 0 }));
            }
            setChatError(null);
            await chatService.updatePresence(participantId, orderNumber);
        } catch (err: any) {
            console.error(err);
            setChatError(err.message || "Failed to send message");
            // Remove optimistic on failure
            setChatMessages((prev) => prev.filter((m) => m.id !== (optimisticId as any)));
        } finally {
            setChatSending(false);
        }
    };

    return (
        <div className="space-y-6">
                <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Ads / Product Status</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-white">Published Orders</h1>
            </div>

            {error && !loading && (
                <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex items-center gap-3">
                        <IonIcon name="warning-outline" className="text-xl text-rose-400" />
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">Failed To Load Orders</p>
                            <p className="mt-1 text-xs text-rose-200/70">{error}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => loadOrders(false)}
                        className="rounded-xl border border-rose-500/25 bg-rose-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-rose-200 transition hover:bg-rose-500/25"
                    >
                        Retry
                    </button>
                </div>
            )}

            <div className="no-scrollbar overflow-x-auto rounded-[1.8rem] border border-white/6 bg-[#171311] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex flex-wrap gap-1">
                    {STAGE_TABS.map((tab) => {
                        const isActive = activeTab === tab.key;
                        const count = counts[tab.key];

                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex shrink-0 items-center gap-2.5 rounded-[1rem] px-4 py-3 transition-all ${
                                    isActive
                                        ? "bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.08)]"
                                        : "text-[#6980aa] hover:bg-white/[0.04] hover:text-[#8ba2d1]"
                                }`}
                            >
                                <IonIcon name={tab.icon} className="text-base" />
                                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.14em]">{tab.label}</span>
                                <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-[9px] font-black ${isActive ? "bg-black/10 text-black" : "bg-white/[0.06] text-white/80"}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 py-3">
                    <IonIcon name="search-outline" className="text-lg text-white/45" />
                    <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search by Order ID, Product Name, Seller Name, Seller Googer ID, Buyer Name, or Buyer Googer ID"
                        className="w-full bg-transparent text-[11px] font-semibold text-white outline-none placeholder:text-white/25"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-white/50 transition hover:bg-white/[0.1] hover:text-white"
                        >
                            <IonIcon name="close-outline" className="text-base" />
                        </button>
                    )}
                </div>
            </div>

            <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] border border-white/5 bg-[#050505] p-3 sm:p-4 lg:p-5">
                {loading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm">
                        <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-white" />
                    </div>
                )}

                {paginatedItems.length === 0 && !loading ? (
                    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] text-slate-700">
                            <IonIcon name="bag-check-outline" className="text-3xl" />
                        </div>
                        <p className="mt-7 text-lg font-black uppercase tracking-[0.2em] text-[#49556e]">
                            {searchQuery ? "No Orders Match This Search" : "No Orders In This Section"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {paginatedItems.map(({ group, item }) => {
                            const status = normalizeStatus(item.status);
                            const buyerReport = parseOrderReport(item.buyer_report);
                            const sellerReport = parseOrderReport(item.seller_report);
                            const buyerReportTag = item.buyer_report ? getOrderReportStatusTag(item) : null;
                            const sellerReportTag = item.seller_report ? getOrderReportStatusTag(item) : null;
                            const shippingLines = getShippingBoxLines(item.shipping_address, group.buyer.name);
                            const orderTotal = getOrderTotal(group.items);

                            return (
                                <div key={item.id} className="w-full rounded-[2rem] border border-white/5 bg-[#221d19] px-4 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] border border-white/5 bg-white/[0.03] text-white/30">
                                                <IonIcon name="receipt-outline" className="text-xl" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-[15px] font-black text-white tracking-[0.08em] uppercase">
                                                    {group.orderNumber || item.order_number || item.id}
                                                </h3>
                                                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/30">
                                                    {group.items.length} Product{group.items.length > 1 ? "s" : ""} â€¢ {formatDateTime(group.createdAt || item.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1 italic">Order Total</p>
                                                <p className="text-[13px] font-black italic text-white">
                                                    <span className="mr-1 text-[10px] text-white/50">R</span>{orderTotal.toFixed(2)}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setViewingOrderGroup(group.items)}
                                                className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04] text-white/45 transition hover:bg-white/[0.08] hover:text-white"
                                            >
                                                <IonIcon name="eye-outline" className="text-lg" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-[1.8rem] border border-white/5 bg-[#1c1c1c] px-4 py-3">
                                        <div className="grid w-full grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_300px_175px]">
                                            <div className="flex w-full min-w-0 items-center gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => item.image_url && setProductImagePreview({ src: item.image_url, title: item.title || `Order ${item.id}` })}
                                                    disabled={!item.image_url}
                                                    className="h-20 w-20 shrink-0 overflow-hidden rounded-[1.2rem] bg-white/5 text-left transition hover:ring-2 hover:ring-white/20 disabled:cursor-default disabled:hover:ring-0"
                                                >
                                                    {item.image_url ? (
                                                        <img src={item.image_url} alt={item.title || `Order ${item.id}`} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-white/30">
                                                            <IonIcon name="bag-handle-outline" className="text-3xl" />
                                                        </div>
                                                    )}
                                                </button>

                                                <div className="min-w-0 flex-1 overflow-hidden">
                                                    <h4 className="truncate text-white text-sm font-black uppercase tracking-tight">
                                                        {item.title || `Item #${item.item_id}`}
                                                    </h4>
                                                    <div className="flex flex-wrap items-center gap-3 mt-1.5 opacity-60">
                                                        <span className="flex items-start gap-1">
                                                            <IonIcon name="person-circle-outline" className="mt-[1px] text-[10px] text-white" />
                                                            <span className="flex flex-col">
                                                                <Link
                                                                    href={`/admin/users/${group.seller.id}?returnTo=${pathname}&from=ProductStatus`}
                                                                    className="text-[8px] font-black uppercase tracking-widest italic text-white/90 transition-colors hover:text-white"
                                                                >
                                                                    Seller: @{group.seller.username || group.seller.name}
                                                                </Link>
                                                                <span className="text-[7px] font-black uppercase tracking-widest text-white/35">
                                                                    ID: {group.seller.googerId}
                                                                </span>
                                                            </span>
                                                        </span>
                                                        <span className="flex items-start gap-1">
                                                            <IonIcon name="people-outline" className="mt-[1px] text-[10px] text-white" />
                                                            <span className="flex flex-col">
                                                                <Link
                                                                    href={`/admin/users/${group.buyer.id}?returnTo=${pathname}&from=ProductStatus`}
                                                                    className="text-[8px] font-black uppercase tracking-widest italic text-white/90 transition-colors hover:text-white"
                                                                >
                                                                    Buyer: @{group.buyer.username || group.buyer.name}
                                                                </Link>
                                                                <span className="text-[7px] font-black uppercase tracking-widest text-white/35">
                                                                    ID: {group.buyer.googerId}
                                                                </span>
                                                            </span>
                                                        </span>
                                                        <span className="text-[8px] font-black text-white uppercase tracking-widest italic flex items-center gap-1">
                                                            <IonIcon name="pricetag-outline" className="text-[10px]" />
                                                            Price: R {Number(item.total_price || 0).toFixed(2)}
                                                        </span>
                                                        {item.size && item.size !== "None" && (
                                                            <span className="text-[8px] font-black text-white uppercase tracking-widest italic flex items-center gap-1">
                                                                <IonIcon name="resize-outline" className="text-[10px]" />
                                                                Size: {item.size}
                                                            </span>
                                                        )}
                                                        <span className="text-[8px] font-black text-white uppercase tracking-widest italic flex items-center gap-1">
                                                            <IonIcon name="layers-outline" className="text-[10px]" />
                                                            Qty: {item.quantity}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                className="min-h-[80px] w-full rounded-xl border border-blue-500/10 bg-blue-500/5 px-3 py-2 text-left shadow-inner transition-all hover:bg-blue-500/10 hover:border-blue-400/20 active:scale-[0.99]"
                                            >
                                                <div className="flex items-center gap-1.5 text-[7px] font-black text-blue-400/50 uppercase tracking-widest leading-none mb-1">
                                                    <IonIcon name="navigate-outline" className="text-[10px]" />
                                                    Shipping Address
                                                </div>
                                                <div className="space-y-1">
                                                    {shippingLines.map((line, index) => (
                                                        <div key={`${item.id}-shipping-line-${index}`} className={`font-bold text-white/70 leading-tight tracking-tight ${index === 0 ? "text-[9px] uppercase" : "text-[8px]"}`}>
                                                            {line}
                                                        </div>
                                                    ))}
                                                </div>
                                            </button>

                                            <div className="flex w-full flex-col items-start gap-2 xl:items-end">
                                                <div className="flex w-full flex-wrap items-center gap-3 xl:justify-end">
                                                    <div className="flex items-center gap-2">
                                                        <div className="px-2 py-1 bg-white/5 rounded-lg border border-white/10">
                                                            <span className={`text-[7px] font-black uppercase tracking-widest leading-none ${
                                                                item.status === "cancelled" ? "text-red-400" :
                                                                (status === "processing" || status === "shipped") ? "text-emerald-400" :
                                                                status === "delivered" ? "text-blue-400" :
                                                                status === "received" ? "text-amber-400" :
                                                                "text-white/60"
                                                            }`}>
                                                                {item.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {canCancelOrder(item) && (
                                                        <button
                                                            onClick={() => openConfirm(item, "cancelled")}
                                                            className="px-3 py-1.5 bg-white/5 hover:bg-red-500 text-white/40 hover:text-white text-[8px] font-black uppercase rounded-lg border border-white/5 transition-all active:scale-95"
                                                        >
                                                            {savingOrderId === item.id && confirmDialog.nextStatus === "cancelled" ? "Saving..." : "Cancel"}
                                                        </button>
                                                    )}
                                                </div>

                                                {(buyerReport || sellerReport) && (
                                                <div className="mt-2 flex w-full flex-col items-start gap-2">
                                                    {buyerReport && (
                                                        <button
                                                            type="button"
                                                            className="w-full text-left transition-all active:scale-[0.99]"
                                                        >
                                                            {buyerReportTag && (
                                                                <div className="mb-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-amber-300">
                                                                    <IonIcon name={buyerReportTag.icon} className="text-[10px]" />
                                                                    <span>{buyerReportTag.label}</span>
                                                                </div>
                                                            )}
                                                            <span className="block text-[9px] font-black uppercase tracking-widest text-red-500">
                                                                Reported by Buyer
                                                            </span>
                                                            <span className="block break-words text-[8px] font-bold uppercase tracking-wide text-white/60">
                                                                {getReportReason(buyerReport)}
                                                            </span>
                                                        </button>
                                                    )}
                                                    {sellerReport && (
                                                        <button
                                                            type="button"
                                                            className="w-full text-left transition-all active:scale-[0.99]"
                                                        >
                                                            {sellerReportTag && (
                                                                <div className="mb-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-amber-300">
                                                                    <IonIcon name={sellerReportTag.icon} className="text-[10px]" />
                                                                    <span>{sellerReportTag.label}</span>
                                                                </div>
                                                            )}
                                                            <span className="block text-[9px] font-black uppercase tracking-widest text-red-500">
                                                                Reported by Seller
                                                            </span>
                                                            <span className="block break-words text-[8px] font-bold uppercase tracking-wide text-white/60">
                                                                {getReportReason(sellerReport)}
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex w-full items-center justify-between gap-3 border-t border-white/5 pt-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openChat(group, "seller")}
                                                className="h-9 rounded-xl border border-white/5 bg-white/5 px-4 py-1.5 text-[10px] font-black uppercase text-white/30"
                                            >
                                                Seller Chat Available
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openChat(group, "seller")}
                                                className="relative flex h-9 items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-1.5 text-[10px] font-black uppercase text-white transition-all active:scale-95 hover:bg-white/10"
                                            >
                                                {(unreadCounts[`${group.seller.id}:${group.orderNumber}`] ?? 0) > 0 && (
                                                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[8px] font-black text-white ring-2 ring-[#0c0c0e]">
                                                        {unreadCounts[`${group.seller.id}:${group.orderNumber}`] > 9 ? "9+" : unreadCounts[`${group.seller.id}:${group.orderNumber}`]}
                                                    </span>
                                                )}
                                                <IonIcon name="chatbubble-ellipses-outline" className="text-sm" />
                                                Chat with Seller
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openChat(group, "buyer")}
                                                className="relative flex h-9 items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-1.5 text-[10px] font-black uppercase text-white transition-all active:scale-95 hover:bg-white/10"
                                            >
                                                {(unreadCounts[`${group.buyer.id}:${group.orderNumber}`] ?? 0) > 0 && (
                                                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[8px] font-black text-white ring-2 ring-[#0c0c0e]">
                                                        {unreadCounts[`${group.buyer.id}:${group.orderNumber}`] > 9 ? "9+" : unreadCounts[`${group.buyer.id}:${group.orderNumber}`]}
                                                    </span>
                                                )}
                                                <IonIcon name="chatbubble-ellipses-outline" className="text-sm" />
                                                Chat with Buyer
                                            </button>
                                            {canMarkAsReceived(item) ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openConfirm(item, "received")}
                                                    disabled={savingOrderId === item.id}
                                                    className="h-9 rounded-xl bg-emerald-500 px-4 py-1.5 text-[10px] font-black uppercase text-white transition-all active:scale-95 shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
                                                >
                                                    {savingOrderId === item.id && confirmDialog.nextStatus === "received" ? "Saving..." : "Mark as Received"}
                                                </button>
                                            ) : null}
                                        </div>
                                        <span className="text-[8px] font-black uppercase tracking-widest text-white/25">
                                            Updated {getShortDate(item.updated_at)}
                                        </span>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {visibleItems.length > ORDERS_PER_PAGE && (
                <div className="flex items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[9px] font-black uppercase tracking-[0.08em] text-white/70 transition hover:bg-white/[0.09] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        Previous
                    </button>
                    <div className="text-[10px] font-black uppercase tracking-[0.1em] text-white/45">
                        Page {currentPage} / {totalPages}
                    </div>
                    <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        disabled={currentPage === totalPages}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[9px] font-black uppercase tracking-[0.08em] text-white/70 transition hover:bg-white/[0.09] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        Next
                    </button>
                </div>
            )}

            {viewingOrderGroup && (
                <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/90 p-2 backdrop-blur-xl sm:p-3" onClick={() => setViewingOrderGroup(null)}>
                    <div className="relative flex max-h-[74vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#0c0c0e] shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] sm:max-h-[80vh]" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between border-b border-white/5 px-4 py-4 sm:px-5">
                            <div>
                                <h2 className="text-lg font-black uppercase tracking-widest text-white">Order Summary</h2>
                                <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/40">
                                    Order #{viewingOrderGroup[0]?.order_number || viewingOrderGroup[0]?.id}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingOrderGroup(null)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                            >
                                <IonIcon name="close-outline" className="text-lg" />
                            </button>
                        </div>

                        <div className="max-h-[74vh] space-y-4 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
                            <div className="space-y-3">
                                <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Purchased Items ({viewingOrderGroup.length})</h4>
                                {viewingOrderGroup.map((orderItem) => (
                                    <div key={orderItem.id} className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#1a1a1a] p-3 sm:flex-row sm:items-center">
                                        <button
                                            type="button"
                                            onClick={() => orderItem.image_url && setProductImagePreview({ src: orderItem.image_url, title: orderItem.title || `Order ${orderItem.id}` })}
                                            disabled={!orderItem.image_url}
                                            className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5 text-left transition hover:ring-2 hover:ring-white/20 disabled:cursor-default disabled:hover:ring-0"
                                        >
                                            {orderItem.image_url ? (
                                                <img src={orderItem.image_url} alt={orderItem.title || `Order ${orderItem.id}`} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-white/30">
                                                    <IonIcon name="bag-handle-outline" className="text-2xl" />
                                                </div>
                                            )}
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <p className="break-words text-sm font-black uppercase tracking-tight text-white">{orderItem.title || `Item #${orderItem.item_id}`}</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-3 opacity-60">
                                                <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest italic text-white">
                                                    <IonIcon name="person-circle-outline" className="text-[10px]" />
                                                    Seller: @{orderItem.seller_username || "seller"}
                                                </span>
                                                <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest italic text-white">
                                                    <IonIcon name="people-outline" className="text-[10px]" />
                                                    Buyer: @{orderItem.buyer_username || "buyer"}
                                                </span>
                                                <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest italic text-white">
                                                    <IonIcon name="pricetag-outline" className="text-[10px]" />
                                                    Price: R {Number(orderItem.total_price || 0).toFixed(2)}
                                                </span>
                                                <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest italic text-white">
                                                    <IonIcon name="layers-outline" className="text-[10px]" />
                                                    Qty: {orderItem.quantity || 1}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Order Details</h4>
                                    <div className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-4 shadow-inner">
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider">
                                            <span className="text-white/40">Items Subtotal</span>
                                            <span className="text-white">R {viewingOrderGroup.reduce((acc, item) => acc + Number(item.total_price || 0), 0).toFixed(2)}</span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-[10px] font-black uppercase tracking-wider">
                                            <span className="text-white/40">Delivery Charge</span>
                                            <span className="text-white">R {viewingOrderGroup.reduce((sum, item) => sum + Number(item.shipping_fee || 0), 0).toFixed(2)}</span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-[10px] font-black uppercase tracking-wider">
                                            <span className="text-white/40">Payment Method</span>
                                            <span className="text-amber-400">{PAYMENT_LABELS[viewingOrderGroup[0]?.payment_method || ""] || viewingOrderGroup[0]?.payment_method || "Payment"}</span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
                                            <span className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Grand Total</span>
                                            <span className="text-lg font-black italic tracking-tighter text-white">R {getOrderTotal(viewingOrderGroup).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Shipping Information</h4>
                                    <div className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-3 text-[10px] font-medium leading-relaxed text-white/70 shadow-inner">
                                        <div className="rounded-[1.15rem] border border-white/8 bg-black/20 p-3 space-y-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-400">Shipping Details</span>
                                                <IonIcon name="location-outline" className="text-sm text-blue-400/70" />
                                            </div>
                                            {getShippingBoxLines(viewingOrderGroup[0].shipping_address, viewingOrderGroup[0].buyer_name || viewingOrderGroup[0].buyer_username).map((line, index) => (
                                                <div key={`summary-shipping-${index}`} className="space-y-0.5">
                                                    <div className="text-[10px] font-bold leading-snug break-words whitespace-pre-wrap text-white/80">{line}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Buyer Details</h4>
                                    <div className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-4 shadow-inner text-[10px] font-bold uppercase tracking-wider text-white/75 space-y-2">
                                        <div>Buyer Name: <span className="text-white">{viewingOrderGroup[0].buyer_name || viewingOrderGroup[0].buyer_username || "Buyer"}</span></div>
                                        <div>Buyer ID: <span className="text-white">{viewingOrderGroup[0].buyer_googer_id || viewingOrderGroup[0].buyer_id}</span></div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Seller Details</h4>
                                    <div className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-4 shadow-inner text-[10px] font-bold uppercase tracking-wider text-white/75 space-y-2">
                                        <div>Seller Name: <span className="text-white">{viewingOrderGroup[0].seller_name || viewingOrderGroup[0].seller_username || "Seller"}</span></div>
                                        <div>Seller ID: <span className="text-white">{viewingOrderGroup[0].seller_googer_id || viewingOrderGroup[0].seller_id}</span></div>
                                    </div>
                                </div>
                            </div>

                            {(viewingOrderGroup.some((item) => item.buyer_report) || viewingOrderGroup.some((item) => item.seller_report)) && (
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Reported by Buyer</h4>
                                        <div className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-4 shadow-inner text-[10px] font-bold text-white/75">
                                            {getReportReason(parseOrderReport(viewingOrderGroup.find((item) => item.buyer_report)?.buyer_report || null))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Reported by Seller</h4>
                                        <div className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-4 shadow-inner text-[10px] font-bold text-white/75">
                                            {getReportReason(parseOrderReport(viewingOrderGroup.find((item) => item.seller_report)?.seller_report || null))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2.5 border-t border-white/5 bg-black/20 p-4 sm:p-5">
                            {viewingOrderGroup.every((item) => canMarkAsReceived(item)) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const target = viewingOrderGroup[0];
                                        setViewingOrderGroup(null);
                                        openConfirm(target, "received");
                                    }}
                                    className="w-full rounded-2xl bg-emerald-600 py-3.5 text-[11px] font-black uppercase text-white transition-all active:scale-95 hover:bg-emerald-500"
                                >
                                    Mark as Received
                                </button>
                            )}
                            {viewingOrderGroup.some((item) => canCancelOrder(item)) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const target = viewingOrderGroup.find((item) => canCancelOrder(item));
                                        if (target) {
                                            setViewingOrderGroup(null);
                                            openConfirm(target, "cancelled");
                                        }
                                    }}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 text-[11px] font-black uppercase text-white transition-all hover:bg-red-500 hover:text-white"
                                >
                                    Cancel Order
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setViewingOrderGroup(null)}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 text-[11px] font-black uppercase text-white transition-all hover:bg-white/10"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {productImagePreview && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 p-3 backdrop-blur-xl" onClick={() => setProductImagePreview(null)}>
                    <div className="relative max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#0c0c0e] shadow-[0_40px_90px_rgba(0,0,0,0.95)]" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                            <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-white">
                                {productImagePreview.title}
                            </p>
                            <button
                                type="button"
                                onClick={() => setProductImagePreview(null)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/45 transition hover:bg-white/10 hover:text-white"
                            >
                                <IonIcon name="close-outline" className="text-lg" />
                            </button>
                        </div>
                        <div className="flex max-h-[calc(88vh-58px)] items-center justify-center bg-black">
                            <img
                                src={productImagePreview.src}
                                alt={productImagePreview.title}
                                className="max-h-[calc(88vh-58px)] w-full object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}

            {assignmentModalOrder && (
                <div className="fixed inset-0 z-[205] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
                    <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c0c0e] shadow-[0_40px_90px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Chat Assignment</p>
                                <h3 className="mt-1 text-lg font-black text-white">Order #{assignmentModalOrder.orderNumber}</h3>
                                <p className="mt-1 text-[11px] text-white/40">
                                    Pick an Admin to handle Buyer and Seller communication for this product-status record.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeAssignmentModal}
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                            >
                                <IonIcon name="close-outline" className="text-lg" />
                            </button>
                        </div>

                        <div className="space-y-4 p-5">
                            <input
                                value={assignmentSearch}
                                onChange={(event) => setAssignmentSearch(event.target.value)}
                                placeholder="Search Admin by username, name or email"
                                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20"
                            />

                            {assignmentError && (
                                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                                    {assignmentError}
                                </div>
                            )}

                            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                                {filteredAdminCandidates.map((admin) => {
                                    const selected = Number(assignments[assignmentModalOrder.orderNumber]?.assigned_admin_id) === Number(admin.id);
                                    return (
                                        <button
                                            key={admin.id}
                                            type="button"
                                            onClick={() => assignAdminToOrder(admin.id)}
                                            disabled={assigningAdminId !== null}
                                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                                                selected
                                                    ? "border-blue-500/30 bg-blue-500/10"
                                                    : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-black text-white">
                                                    {admin.full_name || admin.username}
                                                </div>
                                                <div className="mt-1 truncate text-[11px] text-white/40">
                                                    @{admin.username}{admin.email ? ` · ${admin.email}` : ""}
                                                </div>
                                            </div>
                                            <div className="shrink-0">
                                                {assigningAdminId === admin.id ? (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Saving...</span>
                                                ) : selected ? (
                                                    <span className="rounded-full border border-blue-400/30 bg-blue-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-200">Assigned</span>
                                                ) : (
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/60">Assign</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                                {filteredAdminCandidates.length === 0 && (
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/40">
                                        No Admin users matched this search.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {chatSidebar.isOpen && chatSidebar.participant && (
                <div className="fixed inset-y-0 right-0 z-[120] flex h-full w-full max-w-[420px] flex-col border-l border-white/10 bg-[#0c0c0e] shadow-[-30px_0_80px_rgba(0,0,0,0.75)]">
                    <div className="border-b border-white/10 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                {chatSidebar.participant.profile_picture ? (
                                    <img src={chatSidebar.participant.profile_picture} alt={chatSidebar.participant.name} className="h-11 w-11 rounded-full object-cover" />
                                ) : (
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/40">
                                        <IonIcon name="person-outline" className="text-lg" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="truncate text-[12px] font-black uppercase tracking-[0.16em] text-white">{chatSidebar.participant.name}</p>
                                    <p className="mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/35">
                                        Chat with {chatSidebar.participant.roleLabel}
                                    </p>
                                    {chatSidebar.contextLabel && (
                                        <p className="mt-1 truncate text-[8px] font-black uppercase tracking-[0.16em] text-blue-300/70">
                                            {chatSidebar.contextLabel}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeChat}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/60 transition hover:bg-white/[0.1] hover:text-white"
                            >
                                <IonIcon name="close-outline" className="text-lg" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-3 py-3">
                        {chatLoading ? (
                            <div className="flex h-full items-center justify-center">
                                <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-white" />
                            </div>
                        ) : chatMessages.length === 0 ? (
                            <div className="flex h-full items-center justify-center px-6 text-center">
                                <div>
                                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/30">
                                        <IonIcon name="chatbubbles-outline" className="text-2xl" />
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/25">
                                        {chatSidebar.contextLabel
                                            ? `${chatSidebar.contextLabel} with ${chatSidebar.participant.name}`
                                            : `Start chatting with ${chatSidebar.participant.name}`}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {chatMessages.map((message) => {
                                    const isMine = currentUserId !== null && String(message.sender_id) === String(currentUserId);
                                    const participantName = chatSidebar.participant?.name || "User";
                                    return (
                                        <div key={message.id} className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                                            {!isMine && (
                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[8px] font-black text-white/50 overflow-hidden">
                                                    {chatSidebar.participant?.profile_picture ? (
                                                        <img src={chatSidebar.participant.profile_picture} alt={participantName} className="h-full w-full object-cover" />
                                                    ) : participantName.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className={`max-w-[78%] rounded-[1.2rem] border px-3 py-2.5 ${
                                                isMine
                                                    ? "border-blue-500/20 bg-blue-500/15 text-white"
                                                    : "border-white/10 bg-white/5 text-white/80"
                                                }`}>
                                                <div className="mb-1 text-[6px] font-black uppercase tracking-widest opacity-50">
                                                    {isMine ? currentUserDisplayName : participantName}
                                                </div>
                                                {message.type === "text" && (
                                                    <p className="text-[10px] leading-relaxed break-words">{stripChatColorTags(message.text)}</p>
                                                )}
                                                {message.type === "image" && message.image_url && (
                                                    <div className="space-y-2">
                                                        <img src={message.image_url} alt={message.file_name || "Chat image"} className="h-36 w-36 rounded-xl object-cover" />
                                                        <div className="text-[7px] font-black uppercase tracking-widest opacity-50">
                                                            {message.file_name || "Image"}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="mt-1.5 text-[6px] font-black uppercase tracking-widest opacity-30">
                                                    {new Date(message.created_at || Date.now()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            </div>
                                            {isMine && (
                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[9px] font-black text-white">
                                                    G
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <div ref={messageEndRef} />
                            </div>
                        )}
                    </div>

                    <div className="border-t border-white/10 bg-black/70 p-3">
                        {chatError && (
                            <div className="mb-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-200">
                                {chatError}
                            </div>
                        )}
                        <div className="flex items-end gap-2">
                            <div className="flex-1 rounded-[1.25rem] border border-white/10 bg-white/5 px-3 py-2.5">
                                <textarea
                                    value={chatMessageInput}
                                    onChange={(event) => setChatMessageInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" && !event.shiftKey) {
                                            event.preventDefault();
                                            handleSendChatMessage();
                                        }
                                    }}
                                    rows={1}
                                    placeholder={chatSidebar.contextLabel
                                        ? `Message ${chatSidebar.participant.name} about this order`
                                        : `Message ${chatSidebar.participant.name}`}
                                    className="w-full resize-none bg-transparent text-[10px] text-white outline-none placeholder:text-white/20"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleSendChatMessage}
                                disabled={chatSending || !chatMessageInput.trim()}
                                className="h-10 rounded-xl bg-blue-600 px-3 text-[8px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {chatSending ? "Sending" : "Send"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {chatSidebar.isOpen && (
                <button
                    type="button"
                    aria-label="Close chat overlay"
                    onClick={closeChat}
                    className="fixed inset-0 z-[110] bg-black/45"
                />
            )}

            {confirmDialog.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => savingOrderId === null && setConfirmDialog((prev) => ({ ...prev, open: false }))}
                    />
                    <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c0c0e] shadow-[0_40px_80px_-10px_rgba(0,0,0,0.9)]">
                        <div className={`h-1 w-full ${confirmDialog.nextStatus === "cancelled" ? "bg-rose-500" : "bg-emerald-500"}`} />
                        <div className="p-5 sm:p-8">
                            <h2 className="mb-2 text-xl font-black text-white">{confirmDialog.title}</h2>
                            <p className="text-sm leading-relaxed text-slate-400">{confirmDialog.message}</p>
                            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                                    disabled={savingOrderId !== null}
                                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-xs font-black uppercase tracking-widest text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirmDialog.orderId && confirmDialog.nextStatus) {
                                            applyOrderStatusUpdate(confirmDialog.orderId, confirmDialog.nextStatus);
                                        }
                                    }}
                                    disabled={savingOrderId !== null}
                                    className={`flex-1 rounded-2xl py-3.5 text-xs font-black uppercase tracking-widest text-white transition disabled:opacity-60 ${
                                        confirmDialog.nextStatus === "cancelled" ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
                                    }`}
                                >
                                    {savingOrderId !== null ? "Processing..." : "Confirm"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
