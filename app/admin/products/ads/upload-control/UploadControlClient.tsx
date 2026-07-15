"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

type UploadControlSettings = {
    min_upload_price: number;
    max_upload_price: number;
    flash_content_price: number;
    flash_preview_seconds: number;
    flash_auto_play: boolean;
    default_topic: string;
    default_content_access_mode: "blurred" | "unblurred";
    normal_user_video_limit_seconds: number;
    subscribed_user_video_limit_seconds: number;
    commission_tiers?: Array<{ min: number; max: number; commission: number }>;
    subscription_commission_tiers?: Array<{ min: number; max: number; commission: number }>;
    flash_commission_tiers?: Array<{ min: number; max: number; commission: number }>;
};

type UploadContentRow = {
    id: number;
    user_id?: number | string | null;
    contentId: string;
    content_id: string;
    content_type?: "vault" | "flash";
    description: string;
    topic: string;
    price: number;
    subscription_packages?: Array<{ id: string; price: number; days: number }>;
    affiliate_commission: number;
    hashtags?: string[];
    allow_comments?: boolean;
    show_link_on_home: boolean;
    external_link?: string;
    media_type: string;
    media_preview: string;
    media_gallery?: string[];
    thumbnail_url?: string;
    content_access_mode?: "blurred" | "unblurred";
    visibility?: "public" | "subscribers_only" | "private";
    preview_mode?: "thumbnail" | "auto_preview";
    preview_url?: string;
    video_duration_seconds?: number;
    videoDurationSeconds?: number;
    video_trim_start_seconds?: number;
    videoTrimStartSeconds?: number;
    video_trim_end_seconds?: number;
    videoTrimEndSeconds?: number;
    video_original_duration_seconds?: number;
    videoOriginalDurationSeconds?: number;
    status: "Pending Approval" | "Approved" | "Rejected" | "Cancelled";
    pending_edit_status?: "Pending Approval" | null;
    has_pending_edit?: boolean;
    pending_edit_submitted_at?: string | null;
    username?: string | null;
    full_name?: string | null;
    profile_picture?: string | null;
    user_type?: string | null;
    rejection_reason?: string | null;
    admin_note?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    approved_at?: string | null;
    likes_count?: number;
    comments_count?: number;
    shares_count?: number;
    views_count?: number;
};

type EngagementTab = "likes" | "comments" | "shares" | "views";

type EngagementActor = {
    id?: number | string | null;
    user_id?: number | string | null;
    username?: string | null;
    full_name?: string | null;
    profile_picture?: string | null;
    created_at?: string | null;
};

type EngagementComment = EngagementActor & {
    parent_id?: number | string | null;
    comment_text?: string | null;
    text?: string | null;
    likes?: number;
    dislikes?: number;
    reports?: number;
};

const DEFAULTS: UploadControlSettings = {
    min_upload_price: 100,
    max_upload_price: 10000,
    flash_content_price: 100,
    flash_preview_seconds: 5,
    flash_auto_play: false,
    default_topic: "Technology",
    default_content_access_mode: "unblurred",
    normal_user_video_limit_seconds: 60,
    subscribed_user_video_limit_seconds: 180,
    commission_tiers: [],
    subscription_commission_tiers: [],
    flash_commission_tiers: [],
};

const STATUS_TABS = [
    { key: "All Content", label: "All Content" },
    { key: "Pending Approval", label: "Under Review" },
    { key: "Approved", label: "Approved" },
    { key: "Rejected", label: "Rejected" },
    { key: "Cancelled", label: "Cancelled" },
] as const;

const SORT_OPTIONS = [
    { key: "latest", label: "Latest Uploads" },
    { key: "likes", label: "Most Likes" },
    { key: "comments", label: "Most Comments" },
    { key: "views", label: "Most Views" },
    { key: "shares", label: "Most Shares" },
] as const;

const REJECTION_REASONS = [
    "Copyright Violation",
    "Spam Content",
    "Inappropriate Content",
    "Community Guidelines Violation",
    "Invalid Price",
    "Duplicate Content",
    "Low-Quality Content",
    "Other",
] as const;

const getVisibilityMeta = (visibility?: UploadContentRow["visibility"]) => {
    if (visibility === "subscribers_only") return { label: "Subscribers Only", icon: "people-outline", className: "border-sky-500/20 bg-sky-500/10 text-sky-300" };
    if (visibility === "private") return { label: "Private", icon: "lock-closed-outline", className: "border-amber-500/20 bg-amber-500/10 text-amber-300" };
    return { label: "Public", icon: "earth-outline", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" };
};

const formatMessage = (error: any, fallback: string) => {
    const text = String(error?.message || fallback);
    if (text.toLowerCase().includes("admin access required")) {
        return fallback;
    }
    return text;
};

const isDirectMediaUrl = (value: string) =>
    /^data:(image|video)\//i.test(value) ||
    /^\/(?:uploads|api|googer-api)\//i.test(value) ||
    /^https?:\/\/[^?#]+\//i.test(value) ||
    /\.(mp4|webm|ogg|mov|m4v|jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(value);

const normalizeAssetUrl = (value?: string | null) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;
    if (raw.startsWith("/uploads/")) return raw.replace(/^\/uploads\//i, "/admin-media/");
    if (raw.startsWith("/")) return raw;
    const normalized = raw.replace(/\\/g, "/");
    const uploadIndex = normalized.toLowerCase().indexOf("uploads/");
    if (uploadIndex >= 0) {
        return `/${normalized.slice(uploadIndex)}`.replace(/^\/uploads\//i, "/admin-media/");
    }
    return raw;
};

const isVideoUrl = (value: string) =>
    /^data:video\//i.test(value) || /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(value);

const getVideoEmbedUrl = (value: string) => {
    try {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./i, "").toLowerCase();
        let videoId = "";
        if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
        if (host.endsWith("youtube.com")) {
            videoId = url.searchParams.get("v") || "";
            const parts = url.pathname.split("/").filter(Boolean);
            if (!videoId && ["embed", "shorts", "live"].includes(parts[0])) videoId = parts[1] || "";
        }
        if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
        const parts = url.pathname.split("/").filter(Boolean);
        if (host.includes("instagram.com") && ["p", "reel", "tv"].includes(parts[0]) && parts[1]) {
            return `https://www.instagram.com/${parts[0]}/${parts[1]}/embed`;
        }
        const tikTokVideoIndex = parts.findIndex((part) => part === "video");
        if (host.includes("tiktok.com") && tikTokVideoIndex >= 0 && parts[tikTokVideoIndex + 1]) {
            return `https://www.tiktok.com/embed/v2/${encodeURIComponent(parts[tikTokVideoIndex + 1])}`;
        }
        if (host.includes("facebook.com") || host.includes("fb.watch")) {
            return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(value)}&show_text=false&autoplay=true&width=560`;
        }
        return /^https?:\/\//i.test(value) && !isVideoUrl(value) ? value : "";
    } catch {
        return "";
    }
};

const getExternalPreviewSource = (value?: string | null) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const normalized = /^(https?:\/\/)/i.test(raw) ? raw : `https://${raw}`;
    if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(normalized)) return normalized;
    return `https://api.microlink.io?url=${encodeURIComponent(normalized)}&screenshot=true&meta=false&embed=screenshot.url`;
};

const getPreviewSource = (item: UploadContentRow) => {
    const mediaType = String(item.media_type || "").toLowerCase();
    const candidates = mediaType === "video" ? (
        item.preview_mode === "auto_preview"
            ? [item.preview_url, item.thumbnail_url, item.media_preview, ...(Array.isArray(item.media_gallery) ? item.media_gallery : [])]
            : [item.thumbnail_url, item.preview_url, item.media_preview, ...(Array.isArray(item.media_gallery) ? item.media_gallery : [])]
    ) : [
        item.thumbnail_url,
        mediaType === "link" ? getExternalPreviewSource(item.external_link) : "",
        item.media_preview,
        ...(Array.isArray(item.media_gallery) ? item.media_gallery : []),
    ];

    for (const candidate of candidates) {
        const normalized = normalizeAssetUrl(candidate);
        if (normalized && isDirectMediaUrl(normalized)) {
            return normalized;
        }
    }

    return "";
};

const getFullMediaSource = (item: UploadContentRow) => {
    const candidates = [item.media_preview, ...(Array.isArray(item.media_gallery) ? item.media_gallery : [])];
    return candidates.map(normalizeAssetUrl).find(Boolean) || "";
};

const getImageGallerySources = (item: UploadContentRow) => {
    const candidates = [
        item.media_preview,
        ...(Array.isArray(item.media_gallery) ? item.media_gallery : []),
    ];
    return Array.from(new Set(candidates.map(normalizeAssetUrl).filter(Boolean)));
};

const getVideoTrimRange = (item: UploadContentRow) => {
    const start = Math.max(0, Number(item.video_trim_start_seconds ?? item.videoTrimStartSeconds ?? 0) || 0);
    const rawEnd = Number(item.video_trim_end_seconds ?? item.videoTrimEndSeconds ?? 0) || 0;
    const originalDuration = Math.max(0, Number(item.video_original_duration_seconds ?? item.videoOriginalDurationSeconds ?? 0) || 0);
    const duration = Math.max(0, Number(item.video_duration_seconds ?? item.videoDurationSeconds ?? 0) || 0);
    const end = rawEnd > start ? rawEnd : (duration > 0 ? start + duration : 0);
    return {
        start,
        end,
        originalDuration,
        hasTrim: end > start && (start > 0 || (originalDuration > 0 && end < originalDuration - 0.25)),
    };
};

const seekToTrimStart = (video: HTMLVideoElement, item: UploadContentRow) => {
    const trim = getVideoTrimRange(item);
    if (!trim.hasTrim) return;
    try {
        if (video.currentTime < trim.start || video.currentTime >= trim.end) {
            video.currentTime = trim.start;
        }
    } catch {}
};

const stopAtTrimEnd = (video: HTMLVideoElement, item: UploadContentRow) => {
    const trim = getVideoTrimRange(item);
    if (!trim.hasTrim || !trim.end) return;
    if (video.currentTime >= trim.end) {
        video.pause();
        try {
            video.currentTime = trim.start;
        } catch {}
    }
};

const getPreviewLabel = (item: UploadContentRow) => {
    const mediaType = String(item.media_type || "").toLowerCase();
    if (mediaType === "video") return "Video Preview";
    if (mediaType === "image") return "Image Preview";
    if (mediaType === "link") return "Link Preview";
    return "Media Preview";
};

const getLinkHost = (value?: string | null) => {
    try {
        return new URL(String(value || "")).hostname.replace(/^www\./i, "");
    } catch {
        return "";
    }
};

const formatPackageDuration = (days: number) => `${days} Day${days === 1 ? "" : "s"}`;

const formatColomboDateTime = (value?: string | null) => {
    if (!value) return "Not available";
    const normalized = value.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(value)
        ? value
        : `${value.replace(" ", "T")}Z`;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return "Not available";
    return new Intl.DateTimeFormat("en-LK", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    }).format(parsed);
};

const formatRelativeSheetTime = (value?: string | null) => {
    if (!value) return "Now";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Now";
    const diffMs = Date.now() - parsed.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return "Now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatColomboDateTime(value);
};

const parseTimestamp = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(value)
        ? value
        : `${value.replace(" ", "T")}Z`;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const getApprovedDisplayTime = (item: UploadContentRow) => {
    const approvedAtTs = parseTimestamp(item.approved_at);
    if (approvedAtTs !== null && approvedAtTs <= Date.now() + 60_000) {
        return item.approved_at || null;
    }
    if (item.status === "Approved") {
        return item.updated_at || item.created_at || null;
    }
    return null;
};

const getContentSortTime = (item: UploadContentRow) => {
    const approvedDisplayTime = getApprovedDisplayTime(item);
    return approvedDisplayTime || item.created_at || item.updated_at || null;
};

const isSupportAccount = (userType?: string | null) => {
    const normalized = String(userType || "").trim().toLowerCase().replace(/-/g, "_");
    return normalized === "super_admin" || normalized === "superadmin";
};

const isApprovedContentRow = (item: UploadContentRow) => item.status === "Approved";

const normalizeExternalUrl = (value?: string | null) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

const normalizeEngagementActor = (item: any): EngagementActor => ({
    id: item?.id ?? item?.user_id ?? null,
    user_id: item?.user_id ?? item?.id ?? null,
    username: item?.username ?? item?.full_name ?? "Anonymous",
    full_name: item?.full_name ?? item?.username ?? "Anonymous",
    profile_picture: item?.profile_picture ?? null,
    created_at: item?.created_at ?? null,
});

const normalizeEngagementComment = (item: any): EngagementComment => ({
    ...normalizeEngagementActor(item),
    parent_id: item?.parent_id ?? null,
    comment_text: item?.comment_text ?? item?.text ?? "",
    text: item?.text ?? item?.comment_text ?? "",
    likes: Number(item?.likes ?? 0),
    dislikes: Number(item?.dislikes ?? 0),
    reports: Number(item?.reports ?? 0),
});

const normalizeCommissionTiers = (tiers: Array<{ min: number; max: number; commission: number }>) => (
    tiers
        .map((tier) => ({
            min: Number(tier.min || 0),
            max: Number(tier.max || 0),
            commission: Number(tier.commission || 0),
        }))
        .sort((a, b) => a.min - b.min || a.max - b.max)
);

const repairCommissionTiers = (
    tiers: Array<{ min: number; max: number; commission: number }>,
    minPrice: number,
    maxPrice: number
) => {
    let previousMax = minPrice - 1;
    const repaired: Array<{ min: number; max: number; commission: number }> = [];
    normalizeCommissionTiers(tiers).forEach((tier) => {
            if (previousMax >= maxPrice) return;
            const min = Math.min(maxPrice, Math.max(minPrice, Math.max(tier.min, previousMax + 1)));
            const max = Math.min(maxPrice, Math.max(min, tier.max));
            previousMax = max;
            repaired.push({
                min,
                max,
                commission: Math.min(100, Math.max(0, tier.commission)),
            });
        });
    return repaired;
};

const repairOpenEndedTiers = (
    tiers: Array<{ min: number; max: number; commission: number }>
) => {
    let previousMax = -1;
    const repaired: Array<{ min: number; max: number; commission: number }> = [];
    normalizeCommissionTiers(tiers).forEach((tier) => {
        const min = Math.max(0, Math.max(tier.min, previousMax + 1));
        const max = Math.max(min, tier.max);
        previousMax = max;
        repaired.push({
            min,
            max,
            commission: Math.min(100, Math.max(0, tier.commission)),
        });
    });
    return repaired;
};

const getTierValidationMessage = (
    tiers: Array<{ min: number; max: number; commission: number }>,
    minPrice: number,
    maxPrice: number,
    label: string
) => {
    const normalized = normalizeCommissionTiers(tiers);
    for (let index = 0; index < normalized.length; index += 1) {
        const tier = normalized[index];
        if (tier.min < minPrice || tier.max > maxPrice) {
            return `Each ${label} tier must stay inside R ${minPrice.toLocaleString()} - R ${maxPrice.toLocaleString()}.`;
        }
        if (tier.max < tier.min) {
            return `Each ${label} tier needs a valid From and To range.`;
        }
        if (tier.commission < 0 || tier.commission > 100) {
            return `${label} commission percentage must stay between 0 and 100.`;
        }
        if (index > 0 && tier.min <= normalized[index - 1].max) {
            return `${label} tiers cannot overlap. The next Price From must be higher than the previous Price To.`;
        }
    }
    return "";
};

const getOpenEndedTierValidationMessage = (
    tiers: Array<{ min: number; max: number; commission: number }>,
    label: string
) => {
    const normalized = normalizeCommissionTiers(tiers);
    for (let index = 0; index < normalized.length; index += 1) {
        const tier = normalized[index];
        if (tier.min < 0) {
            return `Each ${label} tier must start at 0 or higher.`;
        }
        if (tier.max < tier.min) {
            return `Each ${label} tier needs a valid From and To range.`;
        }
        if (tier.commission < 0 || tier.commission > 100) {
            return `${label} commission percentage must stay between 0 and 100.`;
        }
        if (index > 0 && tier.min <= normalized[index - 1].max) {
            return `${label} tiers cannot overlap. The next Price From must be higher than the previous Price To.`;
        }
    }
    return "";
};

const createNextTier = (
    tiers: Array<{ min: number; max: number; commission: number }> = [],
    minPrice: number,
    maxPrice: number
) => {
    const normalized = normalizeCommissionTiers(tiers);
    const previousMax = normalized.length > 0 ? Math.max(...normalized.map((tier) => Number(tier.max || 0))) : minPrice - 1;
    const nextMin = Math.min(maxPrice, Math.max(minPrice, previousMax + 1));
    const nextMax = Math.min(maxPrice, Math.max(nextMin, nextMin + 9));
    return { min: nextMin, max: nextMax, commission: 0 };
};

const createNextOpenEndedTier = (
    tiers: Array<{ min: number; max: number; commission: number }> = []
) => {
    const normalized = normalizeCommissionTiers(tiers);
    const previousMax = normalized.length > 0 ? Math.max(...normalized.map((tier) => Number(tier.max || 0))) : -1;
    const nextMin = Math.max(0, previousMax + 1);
    return { min: nextMin, max: nextMin + 9, commission: 0 };
};

export default function UploadControlClient() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<"content" | "settings">("content");
    const [activeSettingsTab, setActiveSettingsTab] = useState<"vault" | "flash">("vault");
    const [activeStatus, setActiveStatus] = useState<(typeof STATUS_TABS)[number]["key"]>("All Content");
    const [activeSort, setActiveSort] = useState<(typeof SORT_OPTIONS)[number]["key"]>("latest");
    const [form, setForm] = useState<UploadControlSettings>(DEFAULTS);
    const [uploadContents, setUploadContents] = useState<UploadContentRow[]>([]);
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [rejectingContentId, setRejectingContentId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [customRejectReason, setCustomRejectReason] = useState("");
    const [previewItem, setPreviewItem] = useState<UploadContentRow | null>(null);
    const [cardGalleryIndexById, setCardGalleryIndexById] = useState<Record<string, number>>({});
    const [modalGalleryIndex, setModalGalleryIndex] = useState(0);

    useEffect(() => {
        setModalGalleryIndex(0);
    }, [previewItem?.contentId, previewItem?.content_id]);
    const [engagementDetailsId, setEngagementDetailsId] = useState<string | null>(null);
    const [engagementActiveTab, setEngagementActiveTab] = useState<EngagementTab>("comments");
    const [engagementRecords, setEngagementRecords] = useState<Array<EngagementActor | EngagementComment>>([]);
    const [engagementLoading, setEngagementLoading] = useState(false);
    const [engagementError, setEngagementError] = useState<string | null>(null);
    const [flashCommissionTiers, setFlashCommissionTiersState] = useState<Array<{ min: number; max: number; commission: number }>>([]);

    const setFlashCommissionTiers = (tiers: Array<{ min: number; max: number; commission: number }>) => {
        setFlashCommissionTiersState(tiers);
        if (typeof window !== 'undefined') {
            localStorage.setItem('googer_flash_commission_tiers', JSON.stringify(tiers));
        }
    };

    const loadSettings = async () => {
        const result = await adminService.fetchUploadControlSettings();
        const settings = result?.settings || result;
        setForm({
            min_upload_price: Number(settings?.min_upload_price ?? DEFAULTS.min_upload_price),
            max_upload_price: Number(settings?.max_upload_price ?? DEFAULTS.max_upload_price),
            flash_content_price: Number(settings?.flash_content_price ?? DEFAULTS.flash_content_price),
            flash_preview_seconds: Number(settings?.flash_preview_seconds ?? DEFAULTS.flash_preview_seconds),
            flash_auto_play: Boolean(settings?.flash_auto_play ?? DEFAULTS.flash_auto_play),
            default_topic: String(settings?.default_topic || DEFAULTS.default_topic),
            default_content_access_mode: settings?.default_content_access_mode === "blurred" ? "blurred" : "unblurred",
            normal_user_video_limit_seconds: Number(settings?.normal_user_video_limit_seconds ?? DEFAULTS.normal_user_video_limit_seconds),
            subscribed_user_video_limit_seconds: Number(settings?.subscribed_user_video_limit_seconds ?? DEFAULTS.subscribed_user_video_limit_seconds),
            commission_tiers: Array.isArray(settings?.commission_tiers) ? settings.commission_tiers : [],
            subscription_commission_tiers: Array.isArray(settings?.subscription_commission_tiers) ? settings.subscription_commission_tiers : [],
            flash_commission_tiers: Array.isArray(settings?.flash_commission_tiers) ? settings.flash_commission_tiers : [],
        });
    };

    const loadContents = async () => {
        const contents = await adminService.fetchAdminUploadContents();
        setUploadContents(contents);
    };

    useEffect(() => {
        if (activeView !== "content") return;
        let cancelled = false;
        const refresh = async () => {
            try {
                const contents = await adminService.fetchAdminUploadContents();
                if (!cancelled) setUploadContents(contents || []);
            } catch {}
        };
        const interval = window.setInterval(refresh, 15000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [activeView]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                setLoading(true);
                if (typeof window !== 'undefined') {
                    const savedFlashTiers = localStorage.getItem('googer_flash_commission_tiers');
                    if (savedFlashTiers) {
                        setFlashCommissionTiersState(JSON.parse(savedFlashTiers));
                    }
                }
                const [settingsResult, contentsResult] = await Promise.all([
                    adminService.fetchUploadControlSettings(),
                    adminService.fetchAdminUploadContents(),
                ]);
                if (!active) return;
                const settings = settingsResult?.settings || settingsResult;
                setForm({
                    min_upload_price: Number(settings?.min_upload_price ?? DEFAULTS.min_upload_price),
                    max_upload_price: Number(settings?.max_upload_price ?? DEFAULTS.max_upload_price),
                    flash_content_price: Number(settings?.flash_content_price ?? DEFAULTS.flash_content_price),
                    flash_preview_seconds: Number(settings?.flash_preview_seconds ?? DEFAULTS.flash_preview_seconds),
                    flash_auto_play: Boolean(settings?.flash_auto_play ?? DEFAULTS.flash_auto_play),
                    default_topic: String(settings?.default_topic || DEFAULTS.default_topic),
                    default_content_access_mode: settings?.default_content_access_mode === "blurred" ? "blurred" : "unblurred",
                    normal_user_video_limit_seconds: Number(settings?.normal_user_video_limit_seconds ?? DEFAULTS.normal_user_video_limit_seconds),
                    subscribed_user_video_limit_seconds: Number(settings?.subscribed_user_video_limit_seconds ?? DEFAULTS.subscribed_user_video_limit_seconds),
                    commission_tiers: Array.isArray(settings?.commission_tiers) ? settings.commission_tiers : [],
                    subscription_commission_tiers: Array.isArray(settings?.subscription_commission_tiers) ? settings.subscription_commission_tiers : [],
                    flash_commission_tiers: Array.isArray(settings?.flash_commission_tiers) ? settings.flash_commission_tiers : [],
                });
                setUploadContents(contentsResult || []);
                const flashTiers = Array.isArray(settings?.flash_commission_tiers) ? settings.flash_commission_tiers : (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('googer_flash_commission_tiers') || '[]') : []);
                setFlashCommissionTiersState(flashTiers);
                setMessage(null);
            } catch (error: any) {
                if (!active) return;
                setMessage(formatMessage(error, "Failed to load upload content control"));
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => {
            active = false;
        };
    }, []);

    const filteredContents = useMemo(() => {
        const query = search.trim().toLowerCase();
        const byStatus = uploadContents.filter((item) => {
            if (activeStatus === "All Content") return true;
            if (activeStatus === "Cancelled") return String(item.status || "").toLowerCase() === "cancelled";
            return item.status === activeStatus;
        });
        const searched = !query ? byStatus : byStatus.filter((item) =>
            [
                item.contentId || item.content_id,
                item.description,
                item.topic,
                item.full_name,
                item.username,
                String(item.price || ""),
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
        );
        const sorted = [...searched];
        sorted.sort((a, b) => {
            const bSortTime = parseTimestamp(getContentSortTime(b)) || 0;
            const aSortTime = parseTimestamp(getContentSortTime(a)) || 0;
            if (activeSort === "likes") return Number(b.likes_count || 0) - Number(a.likes_count || 0) || bSortTime - aSortTime;
            if (activeSort === "comments") return Number(b.comments_count || 0) - Number(a.comments_count || 0) || bSortTime - aSortTime;
            if (activeSort === "views") return Number(b.views_count || 0) - Number(a.views_count || 0) || bSortTime - aSortTime;
            if (activeSort === "shares") return Number(b.shares_count || 0) - Number(a.shares_count || 0) || bSortTime - aSortTime;
            return bSortTime - aSortTime;
        });
        return sorted;
    }, [activeSort, activeStatus, search, uploadContents]);

    const statusCounts = useMemo(() => ({
        all: uploadContents.length,
        pending: uploadContents.filter((item) => item.status === "Pending Approval").length,
        approved: uploadContents.filter((item) => item.status === "Approved").length,
        rejected: uploadContents.filter((item) => item.status === "Rejected").length,
        cancelled: uploadContents.filter((item) => String(item.status || "").toLowerCase() === "cancelled").length,
    }), [uploadContents]);

    const previewRange = useMemo(
        () => `R ${Number(form.min_upload_price || 0).toLocaleString()} - R ${Number(form.max_upload_price || 0).toLocaleString()}`,
        [form.max_upload_price, form.min_upload_price]
    );

    const commissionTiers = Array.isArray(form.commission_tiers) ? form.commission_tiers : [];
    const subscriptionCommissionTiers = Array.isArray(form.subscription_commission_tiers) ? form.subscription_commission_tiers : [];
    const minUploadPriceValue = Number(form.min_upload_price || 0);
    const maxUploadPriceValue = Number(form.max_upload_price || 0);
    const subscriptionOpenEndedTierError = getOpenEndedTierValidationMessage(
        subscriptionCommissionTiers,
        "subscription commission"
    );
    const subscriptionTierRange = useMemo(() => {
        if (subscriptionCommissionTiers.length === 0) return "No tiers added";
        const normalized = normalizeCommissionTiers(subscriptionCommissionTiers);
        return `R ${Math.min(...normalized.map((tier) => tier.min)).toLocaleString()} - R ${Math.max(...normalized.map((tier) => tier.max)).toLocaleString()}`;
    }, [subscriptionCommissionTiers]);
    const subscriptionTierSummary = useMemo(() => {
        if (subscriptionCommissionTiers.length === 0) {
            return "No tiers added";
        }
        if (subscriptionCommissionTiers.length === 1) {
            const tier = subscriptionCommissionTiers[0];
            return `${Number(tier.min || 0).toLocaleString()} - ${Number(tier.max || 0).toLocaleString()} at ${Number(tier.commission || 0).toLocaleString()}%`;
        }
        return `${subscriptionCommissionTiers.length} tiers configured`;
    }, [subscriptionCommissionTiers]);

    const structuredEngagementComments = useMemo(() => {
        const comments = engagementRecords as EngagementComment[];
        const byParent = new Map<string, EngagementComment[]>();
        comments.forEach((comment) => {
            const key = String(comment.parent_id ?? "root");
            const existing = byParent.get(key) || [];
            existing.push(comment);
            byParent.set(key, existing);
        });

        const sortByCreatedAt = (items: EngagementComment[]) => (
            [...items].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        );

        return sortByCreatedAt(byParent.get("root") || []).map((comment) => ({
            ...comment,
            replies: sortByCreatedAt(byParent.get(String(comment.id)) || []),
        }));
    }, [engagementRecords]);

    useEffect(() => {
        if (!engagementDetailsId) {
            setEngagementRecords([]);
            setEngagementError(null);
            setEngagementLoading(false);
            return;
        }

        let active = true;
        const loadEngagementData = async () => {
            try {
                setEngagementLoading(true);
                setEngagementError(null);
                let result: Array<any> = [];
                if (engagementActiveTab === "likes") {
                    result = await adminService.fetchUploadContentLikes(engagementDetailsId);
                    if (!active) return;
                    setEngagementRecords(result.map(normalizeEngagementActor));
                    return;
                }
                if (engagementActiveTab === "comments") {
                    result = await adminService.fetchUploadContentComments(engagementDetailsId);
                    if (!active) return;
                    setEngagementRecords(result.map(normalizeEngagementComment));
                    return;
                }
                if (engagementActiveTab === "shares") {
                    result = await adminService.fetchUploadContentShares(engagementDetailsId);
                    if (!active) return;
                    setEngagementRecords(result.map(normalizeEngagementActor));
                    return;
                }
                result = await adminService.fetchUploadContentViews(engagementDetailsId);
                if (!active) return;
                setEngagementRecords(result.map(normalizeEngagementActor));
            } catch (error: any) {
                if (!active) return;
                setEngagementRecords([]);
                setEngagementError(formatMessage(error, `Failed to load ${engagementActiveTab}`));
            } finally {
                if (active) setEngagementLoading(false);
            }
        };

        void loadEngagementData();
        return () => {
            active = false;
        };
    }, [engagementActiveTab, engagementDetailsId]);

    useEffect(() => {
        if (!engagementDetailsId) return;
        const interval = window.setInterval(async () => {
            try {
                const contents = await adminService.fetchAdminUploadContents();
                setUploadContents(contents || []);
            } catch {}
        }, 12000);
        return () => window.clearInterval(interval);
    }, [engagementDetailsId]);

    const save = async () => {
        if (!Number.isFinite(Number(form.min_upload_price)) || Number(form.min_upload_price) < 0) {
            setMessage("Vault minimum price must be 0 or greater.");
            return;
        }
        if (!Number.isFinite(Number(form.max_upload_price)) || Number(form.max_upload_price) < Number(form.min_upload_price)) {
            setMessage("Vault maximum price must be greater than or equal to the minimum price.");
            return;
        }
        const minPrice = Number(form.min_upload_price);
        const maxPrice = Number(form.max_upload_price);
        const normalizedCommissionTiers = repairCommissionTiers(commissionTiers, minPrice, maxPrice);
        const normalizedSubscriptionCommissionTiers = repairOpenEndedTiers(subscriptionCommissionTiers);
        const normalizedFlashCommissionTiers = repairOpenEndedTiers(flashCommissionTiers);
        try {
            setSaving(true);
            setMessage(null);
            const result = await adminService.updateUploadControlSettings({
                minUploadPrice: Number(form.min_upload_price),
                maxUploadPrice: Number(form.max_upload_price),
                flashContentPrice: Number(form.flash_content_price),
                flashPreviewSeconds: Number(form.flash_preview_seconds),
                flashAutoPlay: Boolean(form.flash_auto_play),
                normalUserVideoLimitSeconds: Number(form.normal_user_video_limit_seconds),
                subscribedUserVideoLimitSeconds: Number(form.subscribed_user_video_limit_seconds),
                commissionTiers: normalizedCommissionTiers,
                subscriptionCommissionTiers: normalizedSubscriptionCommissionTiers,
                flashCommissionTiers: normalizedFlashCommissionTiers,
            });
            const settings = result?.settings || result;
            setForm((current) => ({
                ...current,
                min_upload_price: Number(settings?.min_upload_price ?? current.min_upload_price),
                max_upload_price: Number(settings?.max_upload_price ?? current.max_upload_price),
                flash_content_price: Number(settings?.flash_content_price ?? current.flash_content_price),
                flash_preview_seconds: Number(settings?.flash_preview_seconds ?? current.flash_preview_seconds),
                flash_auto_play: Boolean(settings?.flash_auto_play ?? current.flash_auto_play),
                normal_user_video_limit_seconds: Number(settings?.normal_user_video_limit_seconds ?? current.normal_user_video_limit_seconds),
                subscribed_user_video_limit_seconds: Number(settings?.subscribed_user_video_limit_seconds ?? current.subscribed_user_video_limit_seconds),
                commission_tiers: Array.isArray(settings?.commission_tiers) ? settings.commission_tiers : current.commission_tiers,
                subscription_commission_tiers: Array.isArray(settings?.subscription_commission_tiers) ? settings.subscription_commission_tiers : current.subscription_commission_tiers,
            }));
            const updatedFlashTiers = Array.isArray(settings?.flash_commission_tiers) ? settings.flash_commission_tiers : flashCommissionTiers;
            setFlashCommissionTiersState(updatedFlashTiers);
            if (typeof window !== 'undefined') {
                localStorage.setItem('googer_flash_commission_tiers', JSON.stringify(updatedFlashTiers));
            }
            setMessage("Upload settings saved");
        } catch (error: any) {
            setMessage(formatMessage(error, "Failed to save upload settings"));
        } finally {
            setSaving(false);
        }
    };

    const reviewContent = async (contentId: string, status: "Approved" | "Rejected") => {
        const finalRejectReason = rejectReason === "Other" ? customRejectReason.trim() : rejectReason;
        if (status === "Rejected" && !finalRejectReason) {
            setMessage("Please choose a rejection reason.");
            return;
        }
        try {
            setReviewingId(contentId);
            const updatedContent = await adminService.updateUploadContentStatus(contentId, {
                status,
                rejectionReason: status === "Rejected" ? finalRejectReason : undefined,
            });
            setUploadContents((current) => current.map((item) => {
                if ((item.contentId || item.content_id) !== contentId) return item;
                return {
                    ...item,
                    ...updatedContent,
                    status,
                    rejection_reason: status === "Rejected" ? finalRejectReason : null,
                    approved_at: status === "Approved" ? (updatedContent?.approved_at || new Date().toISOString()) : item.approved_at,
                };
            }));
            void loadContents();

            if (status === "Approved") {
                setMessage("Upload content approved and live on home feed!");
            } else {
                setMessage("Upload content rejected");
            }

            setRejectingContentId(null);
            setRejectReason("");
            setCustomRejectReason("");
        } catch (error: any) {
            setMessage(formatMessage(error, "Failed to review upload content"));
        } finally {
            setReviewingId(null);
        }
    };

    const deleteContent = async (contentId: string) => {
        if (!window.confirm(`Delete upload content ${contentId}? This cannot be undone.`)) return;
        try {
            setDeletingId(contentId);
            setMessage(null);
            await adminService.deleteUploadContent(contentId);
            setUploadContents((current) => current.filter((item) => (item.contentId || item.content_id) !== contentId));
            setPreviewItem((current) => current && (current.contentId || current.content_id) === contentId ? null : current);
            setMessage("Upload content deleted");
        } catch (error: any) {
            setMessage(formatMessage(error, "Failed to delete upload content"));
        } finally {
            setDeletingId(null);
        }
    };

    const addCommissionTier = () => {
        setForm((current) => ({
            ...current,
            commission_tiers: [
                ...(current.commission_tiers || []),
                createNextTier(current.commission_tiers || [], Number(current.min_upload_price || 0), Number(current.max_upload_price || 0)),
            ],
        }));
    };

    const updateCommissionTier = (index: number, field: "min" | "max" | "commission", value: number) => {
        setForm((current) => ({
            ...current,
            commission_tiers: (current.commission_tiers || []).map((tier, tierIndex) =>
                tierIndex === index ? { ...tier, [field]: Number.isFinite(value) ? value : 0 } : tier
            ),
        }));
    };

    const removeCommissionTier = (index: number) => {
        setForm((current) => ({
            ...current,
            commission_tiers: (current.commission_tiers || []).filter((_, tierIndex) => tierIndex !== index),
        }));
    };

    const addSubscriptionCommissionTier = () => {
        setForm((current) => ({
            ...current,
            subscription_commission_tiers: [
                ...(current.subscription_commission_tiers || []),
                createNextOpenEndedTier(current.subscription_commission_tiers || []),
            ],
        }));
    };

    const updateSubscriptionCommissionTier = (index: number, field: "min" | "max" | "commission", value: number) => {
        setForm((current) => ({
            ...current,
            subscription_commission_tiers: (current.subscription_commission_tiers || []).map((tier, tierIndex) =>
                tierIndex === index ? { ...tier, [field]: Number.isFinite(value) ? value : 0 } : tier
            ),
        }));
    };

    const removeSubscriptionCommissionTier = (index: number) => {
        setForm((current) => ({
            ...current,
            subscription_commission_tiers: (current.subscription_commission_tiers || []).filter((_, tierIndex) => tierIndex !== index),
        }));
    };

    const addFlashCommissionTier = () => {
        setFlashCommissionTiers([
            ...flashCommissionTiers,
            createNextOpenEndedTier(flashCommissionTiers),
        ]);
    };

    const updateFlashCommissionTier = (index: number, field: "min" | "max" | "commission", value: number) => {
        setFlashCommissionTiers(
            flashCommissionTiers.map((tier, tierIndex) =>
                tierIndex === index ? { ...tier, [field]: Number.isFinite(value) ? value : 0 } : tier
            )
        );
    };

    const removeFlashCommissionTier = (index: number) => {
        setFlashCommissionTiers(
            flashCommissionTiers.filter((_, tierIndex) => tierIndex !== index)
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Admin / Vault & Flash Content</p>
                    <h1 className="mt-2 text-xl font-black text-white">Vault Content Control</h1>
                    <p className="mt-2 max-w-2xl text-[13px] text-white/45">
                        Review uploaded content first, then open Upload Settings when you need to change pricing rules.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveView("content")}
                        className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-[8px] font-black uppercase tracking-[0.14em] transition ${activeView === "content" ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"}`}
                    >
                        Uploaded Content
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView("settings")}
                        className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-[8px] font-black uppercase tracking-[0.14em] transition ${activeView === "settings" ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"}`}
                    >
                        Upload Settings
                    </button>
                </div>
            </div>

            {message && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/75">
                    {message}
                </div>
            )}

            {activeView === "content" && (
                <section className="rounded-[24px] border border-white/10 bg-[#0b0b0b] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap gap-2">
                                    {STATUS_TABS.map((tab) => {
                                        return (
                                            <button
                                                key={tab.key}
                                                type="button"
                                                onClick={() => setActiveStatus(tab.key)}
                                                className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[8px] font-black uppercase tracking-[0.14em] transition ${activeStatus === tab.key ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"}`}
                                            >
                                                <span>{tab.label}</span>
                                                <span className={`rounded-full px-2 py-0.5 text-[8px] ${activeStatus === tab.key ? "bg-black/10 text-black" : "bg-white/[0.06] text-white/70"}`}>
                                                    {tab.key === "All Content"
                                                        ? statusCounts.all
                                                        : tab.key === "Pending Approval"
                                                            ? statusCounts.pending
                                                            : tab.key === "Approved"
                                                                ? statusCounts.approved
                                                                : tab.key === "Rejected"
                                                                    ? statusCounts.rejected
                                                                    : statusCounts.cancelled}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {SORT_OPTIONS.map((option) => (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => setActiveSort(option.key)}
                                            className={`inline-flex h-8 items-center rounded-full border px-3 text-[8px] font-black uppercase tracking-[0.14em] transition ${activeSort === option.key ? "border-sky-400/40 bg-sky-500/12 text-sky-100" : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="relative w-full xl:max-w-[420px]">
                                <IonIcon name="search-outline" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-white/30" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search by content ID, topic, user, or price"
                                    className="h-9 w-full rounded-full border border-white/10 bg-[#101010] pl-10 pr-4 text-[12px] font-semibold text-white outline-none transition focus:border-white/25"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {loading ? (
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm font-semibold text-white/45">
                                    Loading uploaded content...
                                </div>
                            ) : filteredContents.length === 0 ? (
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm font-semibold text-white/45">
                                    No uploaded content found for this status.
                                </div>
                            ) : filteredContents.map((item) => {
                                const contentId = item.contentId || item.content_id;
                                const supportAccount = isSupportAccount(item.user_type);
                                const creator = supportAccount ? "Googer Support" : (item.username || item.full_name || "User");
                                const hasLegacySupportAvatar = /ui-avatars\.com\/api\/\?name=G(?:&|$)/i.test(String(item.profile_picture || ""));
                                const creatorAvatar = !supportAccount && hasLegacySupportAvatar ? "" : normalizeAssetUrl(item.profile_picture);
                                const adminProfilePath = item.user_id ? `/admin/users/${item.user_id}` : "";
                                const previewSource = getPreviewSource(item);
                                const fullMediaSource = getFullMediaSource(item);
                                const mediaType = String(item.media_type || "").toLowerCase();
                                const gallerySources = mediaType === "image" ? getImageGallerySources(item) : [];
                                const hasMultipleGalleryImages = gallerySources.length > 1;
                                const activeGalleryIndex = hasMultipleGalleryImages
                                    ? Math.min(cardGalleryIndexById[contentId] || 0, gallerySources.length - 1)
                                    : 0;
                                const currentGallerySource = hasMultipleGalleryImages ? gallerySources[activeGalleryIndex] : "";
                                const isPlayableVideo = mediaType === "video" || (item.content_type === "flash" && mediaType === "link");
                                const externalLink = String(item.external_link || "").trim();
                                const hasThumbnailPreview = Boolean(normalizeAssetUrl(item.thumbnail_url));
                                const shouldBlurPreview = mediaType !== "link"
                                    && String(item.content_access_mode || "").toLowerCase() === "blurred"
                                    && !hasThumbnailPreview;
                                const previewActionTarget = externalLink || previewSource;
                                const canOpenContentPreview = Boolean(fullMediaSource || previewActionTarget);
                                const blurredPreviewSource = normalizeAssetUrl(item.thumbnail_url) || (mediaType === "link" ? getExternalPreviewSource(externalLink) : "") || previewSource;
                                const cardPreviewSource = hasMultipleGalleryImages
                                    ? currentGallerySource
                                    : hasThumbnailPreview ? normalizeAssetUrl(item.thumbnail_url) : previewSource;
                                const reviewNote = item.rejection_reason || item.admin_note || "No rejection note. This content is waiting for review or already approved.";
                                const visibilityMeta = getVisibilityMeta(item.visibility);
                                const subscriptionPackages = Array.isArray(item.subscription_packages) ? item.subscription_packages : [];
                                const allowEngagementDetails = isApprovedContentRow(item);
                                const showReviewActions = item.status === "Pending Approval";
                                const displayLikesCount = allowEngagementDetails ? Number(item.likes_count || 0) : 0;
                                const displayCommentsCount = allowEngagementDetails ? Number(item.comments_count || 0) : 0;
                                const displayViewsCount = allowEngagementDetails ? Number(item.views_count || 0) : 0;
                                const displaySharesCount = allowEngagementDetails ? Number(item.shares_count || 0) : 0;
                                return (
                                    <article key={contentId} className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#171311]">
                                        <div className="flex flex-col gap-4 border-b border-white/8 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <h2 className="text-[11px] font-black text-white">Content ID: {contentId}</h2>
                                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-white/70">
                                                        {item.status}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${visibilityMeta.className}`}>
                                                        <IonIcon name={visibilityMeta.icon} className="text-[10px]" />
                                                        {visibilityMeta.label}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${item.content_type === "flash" ? "border-amber-300/20 bg-amber-400/10 text-amber-200" : "border-cyan-300/20 bg-cyan-400/10 text-cyan-200"}`}>
                                                        <IonIcon name={item.content_type === "flash" ? "flash-outline" : "archive-outline"} className="text-[10px]" />
                                                        {item.content_type === "flash" ? "Flash" : "Vault"}
                                                    </span>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <span className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">{item.topic}</span>
                                                    {adminProfilePath ? (
                                                        <Link href={adminProfilePath} className="group flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] py-1 pl-1 pr-2.5 transition hover:border-blue-400/30 hover:bg-blue-500/10">
                                                            <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-[9px] font-black text-white">
                                                                {creatorAvatar ? <img src={creatorAvatar} alt={creator} className="h-full w-full object-cover" /> : <IonIcon name="person" className="text-xs" />}
                                                            </span>
                                                            <span className="text-[9px] font-black text-white/75 transition group-hover:text-blue-300">{creator}</span>
                                                        </Link>
                                                    ) : (
                                                        <span className="text-[9px] font-black text-white/65">{creator}</span>
                                                    )}
                                                </div>
                                                <p className="mt-2.5 max-w-3xl text-[11px] font-semibold leading-5 text-white/85">
                                                    {item.description || "No description added."}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="pr-2 text-right">
                                                    <p className="text-[7px] font-black uppercase tracking-[0.14em] text-white/35">Set Price</p>
                                                    <p className="mt-1 text-[15px] font-black text-white">R {Number(item.price || 0).toLocaleString()}</p>
                                                </div>
                                                {showReviewActions && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => reviewContent(contentId, "Approved")}
                                                            disabled={reviewingId === contentId}
                                                            className="inline-flex h-7 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 text-[8px] font-black uppercase tracking-[0.14em] text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-60"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setRejectingContentId(contentId);
                                                                const existingReason = String(item.rejection_reason || "");
                                                                const standardReason = REJECTION_REASONS.find((reason) => reason === existingReason);
                                                                setRejectReason(standardReason || (existingReason ? "Other" : ""));
                                                                setCustomRejectReason(standardReason ? "" : existingReason);
                                                            }}
                                                            disabled={reviewingId === contentId}
                                                            className="inline-flex h-7 items-center justify-center rounded-full border border-rose-500/25 bg-rose-500/10 px-3 text-[8px] font-black uppercase tracking-[0.14em] text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-60"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => deleteContent(contentId)}
                                                    disabled={deletingId === contentId || reviewingId === contentId}
                                                    className="inline-flex h-7 items-center justify-center rounded-full border border-rose-500/25 bg-rose-500/10 px-3 text-[8px] font-black uppercase tracking-[0.14em] text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {deletingId === contentId ? "Deleting..." : "Delete"}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                                            <div className="rounded-[1.4rem] border border-white/8 bg-[#111111] p-4">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="grid flex-1 gap-2 text-[11px] text-white/70 sm:grid-cols-2">
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Affiliate Commission</p>
                                                            <p className="mt-1 text-[11px] font-bold text-white">{Number(item.affiliate_commission || 0)}%</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Subscription Packages</p>
                                                            <p className="mt-1 text-[11px] font-bold text-white">{subscriptionPackages.length > 0 ? `${subscriptionPackages.length} Enabled` : "Not enabled"}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Show Linked Content</p>
                                                            <p className="mt-1 text-[11px] font-bold text-white">{item.show_link_on_home ? "Yes" : "No"}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Media Type</p>
                                                            <p className="mt-1 text-[11px] font-bold capitalize text-white">{item.media_type || "Not set"}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Visibility</p>
                                                            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-white">
                                                                <IonIcon name={visibilityMeta.icon} className="text-xs" />
                                                                {visibilityMeta.label}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Uploaded</p>
                                                            <p className="mt-1 text-[11px] font-bold text-white">{formatColomboDateTime(item.created_at)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Approved Time</p>
                                                            <p className="mt-1 text-[11px] font-bold text-white">{formatColomboDateTime(getApprovedDisplayTime(item))}</p>
                                                        </div>
                                                    </div>

                                                    {subscriptionPackages.length > 0 && (
                                                        <div className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.03] p-3">
                                                            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35">Enabled Packages</p>
                                                            <div className="mt-2 space-y-2">
                                                                {subscriptionPackages.map((pkg, index) => (
                                                                    <div key={pkg.id || `${contentId}-pkg-${index}`} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[10px] font-bold text-white/75">
                                                                        <span>Package {index + 1}</span>
                                                                        <span>Rupieer {Number(pkg.price || 0).toLocaleString()} / {formatPackageDuration(Number(pkg.days || 0))}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="w-full max-w-[220px] rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-3">
                                                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35">
                                                            {getPreviewLabel(item)}
                                                        </p>
                                                        <div
                                                            className={`relative mt-2 flex h-[116px] items-center justify-center overflow-hidden rounded-[0.95rem] border border-white/10 bg-black/40 ${canOpenContentPreview ? "cursor-pointer transition hover:border-white/25" : ""}`}
                                                            onClick={() => {
                                                                if (canOpenContentPreview) setPreviewItem(item);
                                                            }}
                                                            role={canOpenContentPreview ? "button" : undefined}
                                                            tabIndex={canOpenContentPreview ? 0 : undefined}
                                                            onKeyDown={(event) => {
                                                                if (!canOpenContentPreview) return;
                                                                if (event.key === "Enter" || event.key === " ") {
                                                                    event.preventDefault();
                                                                    setPreviewItem(item);
                                                                }
                                                            }}
                                                        >
                                                            {shouldBlurPreview && blurredPreviewSource ? (
                                                                <img
                                                                    src={blurredPreviewSource}
                                                                    alt={`${mediaType || "media"} preview`}
                                                                    className="h-full w-full scale-110 object-cover blur-xl"
                                                                />
                                                            ) : cardPreviewSource ? (
                                                                !hasThumbnailPreview && mediaType === "video" && isVideoUrl(cardPreviewSource) ? (
                                                                    <video
                                                                        src={cardPreviewSource}
                                                                        muted
                                                                        autoPlay={item.preview_mode === "auto_preview"}
                                                                        playsInline
                                                                        preload="metadata"
                                                                        onLoadedMetadata={(event) => seekToTrimStart(event.currentTarget, item)}
                                                                        onPlay={(event) => seekToTrimStart(event.currentTarget, item)}
                                                                        onTimeUpdate={(event) => stopAtTrimEnd(event.currentTarget, item)}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <img
                                                                        src={cardPreviewSource}
                                                                        alt={`${mediaType || "media"} preview`}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                )
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center px-3 text-center">
                                                                    <IonIcon name={mediaType === "link" ? "link-outline" : "image-outline"} className="text-lg text-white/35" />
                                                                    <p className="mt-2 text-[10px] font-semibold text-white/55">
                                                                        No preview available
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {hasMultipleGalleryImages && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            setCardGalleryIndexById((current) => ({
                                                                                ...current,
                                                                                [contentId]: activeGalleryIndex === 0 ? gallerySources.length - 1 : activeGalleryIndex - 1,
                                                                            }));
                                                                        }}
                                                                        className="absolute left-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm"
                                                                        aria-label="Previous image"
                                                                    >
                                                                        <IonIcon name="chevron-back-outline" className="text-sm" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            setCardGalleryIndexById((current) => ({
                                                                                ...current,
                                                                                [contentId]: activeGalleryIndex === gallerySources.length - 1 ? 0 : activeGalleryIndex + 1,
                                                                            }));
                                                                        }}
                                                                        className="absolute right-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm"
                                                                        aria-label="Next image"
                                                                    >
                                                                        <IonIcon name="chevron-forward-outline" className="text-sm" />
                                                                    </button>
                                                                </>
                                                            )}

                                                            {shouldBlurPreview && previewSource && (
                                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.56))] px-3 text-center">
                                                                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white">
                                                                        <IonIcon name="eye-off-outline" className="text-[18px]" />
                                                                    </div>
                                                                    <p className="mt-2 text-[11px] font-black text-white">Blurred Content</p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (!previewActionTarget) return;
                                                                            setPreviewItem(item);
                                                                        }}
                                                                        className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white px-3 text-[8px] font-black uppercase tracking-[0.16em] text-black transition hover:bg-white/90"
                                                                    >
                                                                        <IonIcon name="eye-outline" className="text-[11px]" />
                                                                        Watch Now
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {!shouldBlurPreview && hasThumbnailPreview && String(item.content_access_mode || "").toLowerCase() === "blurred" && (
                                                                <div className="pointer-events-none absolute left-3 top-3 z-20 inline-flex h-6 items-center justify-center rounded-full border border-white/15 bg-black/60 px-2 text-[8px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                                                                    Thumbnail Preview
                                                                </div>
                                                            )}
                                                            {!shouldBlurPreview && isPlayableVideo && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewItem(item)}
                                                                    className="absolute bottom-3 left-1/2 z-20 inline-flex h-8 -translate-x-1/2 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-3 text-[8px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-sm"
                                                                >
                                                                    <IonIcon name="play" className="text-[11px]" /> Watch Now
                                                                </button>
                                                            )}
                                                        </div>

                                                        {externalLink && (
                                                            <a
                                                                href={externalLink}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="mt-2 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-[10px] font-semibold text-white/75 transition hover:bg-white/[0.06]"
                                                            >
                                                                <IonIcon name="open-outline" className="text-[11px] text-white/45" />
                                                                <span className="truncate">{getLinkHost(externalLink) || externalLink}</span>
                                                            </a>
                                                        )}

                                                        <div className="mt-3 rounded-[1.2rem] border border-white/8 bg-[#151515] px-3 py-2.5 shadow-[0_16px_30px_rgba(0,0,0,0.24)]">
                                                            <div className="grid grid-cols-4 gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!allowEngagementDetails) return;
                                                                    setEngagementDetailsId(contentId);
                                                                    setEngagementActiveTab("likes");
                                                                }}
                                                                className={`flex items-center justify-center gap-1.5 rounded-full px-1 py-1 text-white/80 transition ${allowEngagementDetails ? "hover:text-white" : "cursor-default opacity-70"}`}
                                                            >
                                                                <IonIcon name="heart-outline" className="text-[18px] text-[#ff5f78]" />
                                                                <span className="text-[11px] font-black leading-none text-white">{displayLikesCount}</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!allowEngagementDetails) return;
                                                                    setEngagementDetailsId(contentId);
                                                                    setEngagementActiveTab("comments");
                                                                }}
                                                                className={`flex items-center justify-center gap-1.5 rounded-full px-1 py-1 text-white/80 transition ${allowEngagementDetails ? "hover:text-white" : "cursor-default opacity-70"}`}
                                                            >
                                                                <IonIcon name="chatbubble-outline" className="text-[18px] text-white/90" />
                                                                <span className="text-[11px] font-black leading-none text-white">{displayCommentsCount}</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!allowEngagementDetails) return;
                                                                    setEngagementDetailsId(contentId);
                                                                    setEngagementActiveTab("views");
                                                                }}
                                                                className={`flex items-center justify-center gap-1.5 rounded-full px-1 py-1 text-white/80 transition ${allowEngagementDetails ? "hover:text-white" : "cursor-default opacity-70"}`}
                                                            >
                                                                <IonIcon name="eye-outline" className="text-[18px] text-white/90" />
                                                                <span className="text-[11px] font-black leading-none text-white">{displayViewsCount}</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!allowEngagementDetails) return;
                                                                    setEngagementDetailsId(contentId);
                                                                    setEngagementActiveTab("shares");
                                                                }}
                                                                className={`flex items-center justify-center gap-1.5 rounded-full px-1 py-1 text-white/80 transition ${allowEngagementDetails ? "hover:text-white" : "cursor-default opacity-70"}`}
                                                            >
                                                                <IonIcon name="share-social-outline" className="text-[18px] text-white/90" />
                                                                <span className="text-[11px] font-black leading-none text-white">{displaySharesCount}</span>
                                                            </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="rounded-[1.4rem] border border-white/8 bg-[#111111] p-4">
                                                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Review Note</p>
                                                <p className="mt-2 text-[11px] font-semibold leading-5 text-white/75">
                                                    {reviewNote}
                                                </p>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {activeView === "settings" && (
                <section className="rounded-[24px] border border-white/10 bg-[#0b0b0b] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                    <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75">
                            <IonIcon name="options-outline" className="text-lg" />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-black text-white">{activeSettingsTab === "vault" ? "Vault Content Settings" : "Flash Content Settings"}</h2>
                            <p className="text-[13px] text-white/45">Switch between Vault and Flash settings below and save when you are done.</p>
                        </div>
                    </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setActiveSettingsTab("vault")}
                                className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[9px] font-black uppercase tracking-[0.16em] transition ${activeSettingsTab === "vault" ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"}`}
                            >
                                <IonIcon name="cloud-upload-outline" className="text-sm" />
                                <span>Vault Content</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSettingsTab("flash")}
                                className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[9px] font-black uppercase tracking-[0.16em] transition ${activeSettingsTab === "flash" ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"}`}
                            >
                                <IonIcon name="flash-outline" className="text-sm" />
                                <span>Flash Content</span>
                            </button>
                            <button
                                type="button"
                                onClick={save}
                                disabled={saving || loading}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-4 text-[8px] font-black uppercase tracking-[0.14em] text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving && <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />}
                                <span>{saving ? "Saving..." : "Save Settings"}</span>
                            </button>
                        </div>
                    </div>

                    {activeSettingsTab === "vault" && (
                    <>
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Vault Minimum Price</span>
                            <input
                                type="number"
                                min={0}
                                value={form.min_upload_price}
                                onChange={(event) => setForm((current) => ({ ...current, min_upload_price: Number(event.target.value) }))}
                                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[13px] font-semibold text-white outline-none transition focus:border-white/25 focus:bg-white/[0.05]"
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Vault Maximum Price</span>
                            <input
                                type="number"
                                min={0}
                                value={form.max_upload_price}
                                onChange={(event) => setForm((current) => ({ ...current, max_upload_price: Number(event.target.value) }))}
                                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[13px] font-semibold text-white outline-none transition focus:border-white/25 focus:bg-white/[0.05]"
                            />
                        </label>
                    </div>
                    </>
                    )}

                    {activeSettingsTab === "flash" && (
                    <div className="mt-5 space-y-5">
                        <div className="rounded-[1.4rem] border border-amber-300/15 bg-amber-400/10 p-6">
                            <div className="mb-6 flex items-start gap-3">
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-300/10 text-amber-100">
                                    <IonIcon name="flash-outline" className="text-xl" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-100/70">Flash Content Configuration</p>
                                    <p className="mt-1 text-[13px] leading-5 text-white/50">Flash uses one fixed admin price and preview duration. Creators cannot customize these settings. All Flash content is priced uniformly across the platform.</p>
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="group space-y-3 rounded-[1rem] border border-amber-300/20 bg-white/[0.02] p-4 transition hover:border-amber-300/40 hover:bg-white/[0.04]">
                                    <div className="flex items-center gap-2">
                                        <IonIcon name="pricetag-outline" className="text-sm text-amber-300/70 transition group-hover:text-amber-300" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/60">Flash Content Price</span>
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.flash_content_price}
                                        onChange={(event) => setForm((current) => ({ ...current, flash_content_price: Number(event.target.value) }))}
                                        className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[14px] font-bold text-amber-200 outline-none transition focus:border-amber-200/40 focus:bg-white/[0.08]"
                                    />
                                    <p className="text-[10px] text-white/40">Uniform price for all Flash content</p>
                                </label>
                                <label className="group space-y-3 rounded-[1rem] border border-amber-300/20 bg-white/[0.02] p-4 transition hover:border-amber-300/40 hover:bg-white/[0.04]">
                                    <div className="flex items-center gap-2">
                                        <IonIcon name="timer-outline" className="text-sm text-amber-300/70 transition group-hover:text-amber-300" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/60">Preview Duration</span>
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.flash_preview_seconds}
                                        onChange={(event) => setForm((current) => ({ ...current, flash_preview_seconds: Number(event.target.value) }))}
                                        className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[14px] font-bold text-amber-200 outline-none transition focus:border-amber-200/40 focus:bg-white/[0.08]"
                                    />
                                    <p className="text-[10px] text-white/40">Seconds users can preview</p>
                                </label>
                                <div className="flex items-center justify-between gap-4 rounded-[1rem] border border-amber-300/20 bg-white/[0.02] px-4 py-4 sm:col-span-2 transition hover:border-amber-300/40 hover:bg-white/[0.04]">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/60">Auto Play Videos</p>
                                        <p className="mt-2 text-[12px] font-semibold leading-4 text-white/45">When enabled, Flash Content videos automatically play in user feeds.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setForm((current) => ({ ...current, flash_auto_play: !current.flash_auto_play }))}
                                        className={`relative h-7 w-12 flex-shrink-0 rounded-full border transition ${form.flash_auto_play ? "border-amber-200/40 bg-amber-300" : "border-white/10 bg-white/[0.08]"}`}
                                        aria-pressed={form.flash_auto_play}
                                        aria-label="Toggle flash content autoplay"
                                    >
                                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${form.flash_auto_play ? "left-6" : "left-1"}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[1.4rem] border border-orange-300/15 bg-orange-400/10 p-6">
                            <div className="mb-6 flex items-center justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-orange-200/15 bg-orange-300/10 text-orange-100">
                                        <IonIcon name="flash-outline" className="text-xl" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-100/70">Flash Content Commission Tiers</p>
                                        <p className="mt-1 text-[13px] leading-5 text-white/50">Set price ranges and commission percentages for Flash content. Each tier applies to sales within that price range.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={addFlashCommissionTier}
                                    className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-orange-300/40 bg-orange-300/10 text-orange-200 transition hover:border-orange-300/60 hover:bg-orange-300/15"
                                    aria-label="Add new Flash commission tier"
                                    title="Add Tier"
                                >
                                    <IonIcon name="add-outline" className="text-lg" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {flashCommissionTiers.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-orange-300/20 px-4 py-6 text-center">
                                        <IonIcon name="layers-outline" className="mb-2 text-2xl text-orange-300/40" />
                                        <p className="text-[12px] font-semibold text-orange-100/50">No Flash commission tiers added yet</p>
                                        <p className="mt-1 text-[11px] text-orange-100/40">Click the + button above to create your first tier</p>
                                    </div>
                                ) : (
                                    flashCommissionTiers.map((tier, index) => (
                                        <div key={`flash-tier-${index}`} className="grid gap-3 rounded-[1rem] border border-orange-300/20 bg-white/[0.02] p-4 md:grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                                            <label className="space-y-2">
                                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-100/60">Price From</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={tier.min}
                                                    onChange={(event) => updateFlashCommissionTier(index, "min", Number(event.target.value))}
                                                    className="h-9 w-full rounded-lg border border-orange-300/20 bg-white/[0.03] px-3 text-[12px] font-semibold text-orange-200 outline-none transition focus:border-orange-300/40 focus:bg-white/[0.06]"
                                                    placeholder="0"
                                                />
                                            </label>
                                            <div className="hidden items-end justify-center md:flex">
                                                <span className="mb-2 inline-flex h-9 w-5 items-center justify-center text-[14px] font-black text-orange-300/50">-</span>
                                            </div>
                                            <label className="space-y-2">
                                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-100/60">Price To</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={tier.max}
                                                    onChange={(event) => updateFlashCommissionTier(index, "max", Number(event.target.value))}
                                                    className="h-9 w-full rounded-lg border border-orange-300/20 bg-white/[0.03] px-3 text-[12px] font-semibold text-orange-200 outline-none transition focus:border-orange-300/40 focus:bg-white/[0.06]"
                                                    placeholder="∞"
                                                />
                                            </label>
                                            <label className="space-y-2">
                                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-100/60">Commission %</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={tier.commission}
                                                    onChange={(event) => updateFlashCommissionTier(index, "commission", Number(event.target.value))}
                                                    className="h-9 w-full rounded-lg border border-orange-300/20 bg-white/[0.03] px-3 text-[12px] font-semibold text-orange-200 outline-none transition focus:border-orange-300/40 focus:bg-white/[0.06]"
                                                    placeholder="0"
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => removeFlashCommissionTier(index)}
                                                className="inline-flex h-9 items-center justify-center self-end rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 text-[8px] font-black uppercase tracking-[0.14em] text-rose-300 transition hover:bg-rose-500/15"
                                            >
                                                <IonIcon name="trash-outline" className="text-sm" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    )}

                    {activeSettingsTab === "vault" && (
                    <>
                    <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Commission Tiers</p>
                                <p className="mt-1 text-[13px] text-white/45">Admins can define upload price ranges and the matching commission percentage.</p>
                            </div>
                            <button
                                type="button"
                                onClick={addCommissionTier}
                                className="inline-flex h-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[8px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-white/[0.08]"
                            >
                                Add Tier
                            </button>
                        </div>

                        <div className="space-y-3">
                            {commissionTiers.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
                                    No commission tiers added yet.
                                </div>
                            ) : commissionTiers.map((tier, index) => (
                                <div key={`tier-${index}`} className="grid gap-3 rounded-xl border border-white/10 bg-[#101010] p-3 md:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                                    <label className="space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Price From</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={tier.min}
                                            onChange={(event) => updateCommissionTier(index, "min", Number(event.target.value))}
                                            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12px] font-semibold text-white outline-none transition focus:border-white/25"
                                        />
                                    </label>
                                    <div className="hidden items-end justify-center md:flex">
                                        <span className="mb-2 inline-flex h-9 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[14px] font-black text-white/55">-</span>
                                    </div>
                                    <label className="space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Price To</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={tier.max}
                                            onChange={(event) => updateCommissionTier(index, "max", Number(event.target.value))}
                                            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12px] font-semibold text-white outline-none transition focus:border-white/25"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Commission %</span>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={tier.commission}
                                            onChange={(event) => updateCommissionTier(index, "commission", Number(event.target.value))}
                                            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12px] font-semibold text-white outline-none transition focus:border-white/25"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => removeCommissionTier(index)}
                                        className="inline-flex h-9 items-center justify-center self-end rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 text-[8px] font-black uppercase tracking-[0.14em] text-rose-300 transition hover:bg-rose-500/15"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/75">
                                <IonIcon name="albums-outline" className="text-lg" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Subscription Commission</p>
                                <p className="mt-1 text-[13px] text-white/45">
                                    Vault Content users can add up to 3 subscription packages with their own prices. Their share commission is applied only from the separate subscription package tiers below.
                                </p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">Package Limit</p>
                                        <p className="mt-1 text-[12px] font-bold text-white">3 Packages</p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">Subscription Price Range</p>
                                        <p className="mt-1 text-[12px] font-bold text-white">{subscriptionTierRange}</p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">Share Commission</p>
                                        <p className="mt-1 text-[12px] font-bold text-white">{subscriptionTierSummary}</p>
                                    </div>
                                </div>
                                {subscriptionCommissionTiers.length > 0 && (
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {normalizeCommissionTiers(subscriptionCommissionTiers).map((tier, index) => (
                                            <div key={`subscription-summary-${index}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">Tier {index + 1}</p>
                                                <p className="mt-1 text-[11px] font-bold text-white">
                                                    R {Number(tier.min || 0).toLocaleString()} - R {Number(tier.max || 0).toLocaleString()} / {Number(tier.commission || 0).toLocaleString()}%
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Subscription Package Commission Tiers</p>
                                <p className="mt-1 text-[13px] text-white/45">Set separate price ranges and commission for the Add Subscription Access plans.</p>
                            </div>
                            <button
                                type="button"
                                onClick={addSubscriptionCommissionTier}
                                className="inline-flex h-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[8px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-white/[0.08]"
                            >
                                Add Tier
                            </button>
                        </div>

                        <div className="space-y-3">
                            {subscriptionOpenEndedTierError && (
                                <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[11px] font-bold text-rose-200">
                                    {subscriptionOpenEndedTierError}
                                </div>
                            )}
                            {subscriptionCommissionTiers.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
                                    No subscription commission tiers added yet.
                                </div>
                            ) : subscriptionCommissionTiers.map((tier, index) => (
                                <div key={`subscription-tier-${index}`} className="grid gap-3 rounded-xl border border-white/10 bg-[#101010] p-3 md:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                                    <label className="space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Price From</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={tier.min}
                                            onChange={(event) => updateSubscriptionCommissionTier(index, "min", Number(event.target.value))}
                                            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12px] font-semibold text-white outline-none transition focus:border-white/25"
                                        />
                                    </label>
                                    <div className="hidden items-end justify-center md:flex">
                                        <span className="mb-2 inline-flex h-9 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[14px] font-black text-white/55">-</span>
                                    </div>
                                    <label className="space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Price To</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={tier.max}
                                            onChange={(event) => updateSubscriptionCommissionTier(index, "max", Number(event.target.value))}
                                            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12px] font-semibold text-white outline-none transition focus:border-white/25"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Commission %</span>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={tier.commission}
                                            onChange={(event) => updateSubscriptionCommissionTier(index, "commission", Number(event.target.value))}
                                            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12px] font-semibold text-white outline-none transition focus:border-white/25"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => removeSubscriptionCommissionTier(index)}
                                        className="inline-flex h-9 items-center justify-center self-end rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 text-[8px] font-black uppercase tracking-[0.14em] text-rose-300 transition hover:bg-rose-500/15"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    </>
                    )}

                    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{activeSettingsTab === "vault" ? "Configured Vault Price Range" : "Configured Flash Price"}</p>
                            <p className="mt-1 text-lg font-black text-white">{activeSettingsTab === "vault" ? previewRange : `R ${Number(form.flash_content_price || 0).toLocaleString()}`}</p>
                        </div>
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving || loading}
                            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white px-4 text-[8px] font-black uppercase tracking-[0.14em] text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving && <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />}
                            <span>{saving ? "Saving..." : "Save Settings"}</span>
                        </button>
                    </div>
                </section>
            )}

            {previewItem && (() => {
                const modalMediaType = String(previewItem.media_type || "").toLowerCase();
                const modalPreviewSource = getFullMediaSource(previewItem);
                const modalGallerySources = modalMediaType === "image" ? getImageGallerySources(previewItem) : [];
                const hasModalGallery = modalGallerySources.length > 1;
                const safeModalGalleryIndex = hasModalGallery ? Math.min(modalGalleryIndex, modalGallerySources.length - 1) : 0;
                const modalExternalLink = normalizeExternalUrl(previewItem.external_link);
                const modalSource = modalExternalLink && (modalMediaType === "video" || modalMediaType === "link")
                    ? modalExternalLink
                    : modalMediaType === "link" ? modalExternalLink : (hasModalGallery ? modalGallerySources[safeModalGalleryIndex] : modalPreviewSource);
                const modalEmbedSource = getVideoEmbedUrl(modalSource);
                return (
                    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/85 px-4 py-6 backdrop-blur-md" onClick={() => setPreviewItem(null)}>
                        <div className="w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101114] shadow-[0_30px_100px_rgba(0,0,0,0.65)]" onClick={(event) => event.stopPropagation()}>
                            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                                <div className="min-w-0">
                                    <h3 className="truncate text-[15px] font-black text-white">Content Preview</h3>
                                    <p className="mt-1 truncate text-[10px] font-semibold text-white/45">{previewItem.topic || "Vault Content"} · {previewItem.contentId || previewItem.content_id}</p>
                                </div>
                                <button type="button" onClick={() => setPreviewItem(null)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/65 transition hover:bg-white/[0.1] hover:text-white">
                                    <IonIcon name="close-outline" className="text-lg" />
                                </button>
                            </div>
                            <div className="flex min-h-[320px] max-h-[72vh] items-center justify-center bg-black p-3 sm:p-5">
                                {!modalSource ? (
                                    <div className="text-center text-sm font-semibold text-white/45">No preview is available for this content.</div>
                                ) : isVideoUrl(modalSource) ? (
                                    <video
                                        ref={(el) => {
                                            if (!el) return;
                                            el.muted = false;
                                            el.volume = 1;
                                            seekToTrimStart(el, previewItem);
                                            if (el.paused) {
                                                el.play().catch(() => {});
                                            }
                                        }}
                                        src={modalSource}
                                        poster={normalizeAssetUrl(previewItem.thumbnail_url) || undefined}
                                        controls
                                        playsInline
                                        onLoadedMetadata={(event) => seekToTrimStart(event.currentTarget, previewItem)}
                                        onPlay={(event) => seekToTrimStart(event.currentTarget, previewItem)}
                                        onTimeUpdate={(event) => stopAtTrimEnd(event.currentTarget, previewItem)}
                                        className="max-h-[65vh] w-full rounded-xl object-contain"
                                    />
                                ) : modalEmbedSource ? (
                                    <iframe
                                        src={modalEmbedSource}
                                        title="Linked video content"
                                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                                        allowFullScreen
                                        className="aspect-video max-h-[65vh] w-full rounded-xl border-0 bg-black"
                                    />
                                ) : (
                                    <div className="relative w-full">
                                        <img src={modalSource} alt="Uploaded content preview" className="max-h-[65vh] w-full rounded-xl object-contain" />
                                        {hasModalGallery && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setModalGalleryIndex((current) => current === 0 ? modalGallerySources.length - 1 : current - 1)}
                                                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm"
                                                    aria-label="Previous image"
                                                >
                                                    <IonIcon name="chevron-back-outline" className="text-base" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setModalGalleryIndex((current) => current === modalGallerySources.length - 1 ? 0 : current + 1)}
                                                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm"
                                                    aria-label="Next image"
                                                >
                                                    <IonIcon name="chevron-forward-outline" className="text-base" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {rejectingContentId && (
                <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#111216] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                            <div>
                                <h3 className="text-[15px] font-black text-white">Reject Content</h3>
                                <p className="mt-1 text-[11px] font-semibold text-white/45">Choose the reason that will be shown to the uploader.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setRejectingContentId(null);
                                    setRejectReason("");
                                    setCustomRejectReason("");
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/65 transition hover:bg-white/[0.1] hover:text-white"
                            >
                                <IonIcon name="close-outline" className="text-lg" />
                            </button>
                        </div>
                        <div className="max-h-[58vh] overflow-y-auto px-5 py-5">
                            <span className="mb-3 block text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Rejection Reason</span>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {REJECTION_REASONS.map((reason) => (
                                    <label
                                        key={reason}
                                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[11px] font-bold transition ${rejectReason === reason ? "border-rose-400/40 bg-rose-500/12 text-rose-200" : "border-white/8 bg-white/[0.025] text-white/65 hover:bg-white/[0.05]"}`}
                                    >
                                        <input
                                            type="radio"
                                            name="upload-content-rejection-reason"
                                            value={reason}
                                            checked={rejectReason === reason}
                                            onChange={() => setRejectReason(reason)}
                                            className="h-3.5 w-3.5 accent-rose-500"
                                        />
                                        <span>{reason}</span>
                                    </label>
                                ))}
                            </div>
                            {rejectReason === "Other" && (
                                <label className="mt-4 block">
                                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Other Reason</span>
                                    <textarea
                                        value={customRejectReason}
                                        onChange={(event) => setCustomRejectReason(event.target.value)}
                                        rows={3}
                                        maxLength={500}
                                        placeholder="Enter the rejection reason"
                                        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] font-semibold text-white outline-none transition focus:border-rose-400/40"
                                    />
                                </label>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setRejectingContentId(null);
                                    setRejectReason("");
                                    setCustomRejectReason("");
                                }}
                                className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[9px] font-black uppercase tracking-[0.14em] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => reviewContent(rejectingContentId, "Rejected")}
                                disabled={reviewingId === rejectingContentId || !rejectReason || (rejectReason === "Other" && !customRejectReason.trim())}
                                className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-60"
                            >
                                {reviewingId === rejectingContentId ? "Saving..." : "Reject Content"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {engagementDetailsId && (() => {
                const engagementItem = uploadContents.find((item) => (item.contentId || item.content_id) === engagementDetailsId);
                if (!engagementItem) return null;
                const engagementTitle = engagementActiveTab === "likes"
                    ? "Likes"
                    : engagementActiveTab === "comments"
                        ? "Comments"
                        : engagementActiveTab === "shares"
                            ? "Shares"
                            : "Views";
                const renderActorRow = (actor: EngagementActor, key: string) => {
                    const actorName = actor.username || actor.full_name || "Anonymous";
                    const actorMeta = actor.full_name && actor.full_name !== actorName ? actor.full_name : actor.user_id ? `User #${actor.user_id}` : "Googer member";
                    const actorAvatar = normalizeAssetUrl(actor.profile_picture);
                    return (
                        <div key={key} className="flex items-center gap-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-3 py-3">
                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                                {actorAvatar ? (
                                    <img src={actorAvatar} alt={actorName} className="h-full w-full object-cover" />
                                ) : (
                                    <IonIcon name="person-outline" className="text-base text-white/45" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-black text-white">{actorName}</p>
                                <p className="truncate text-[10px] font-semibold text-white/45">{actorMeta}</p>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
                                {formatRelativeSheetTime(actor.created_at)}
                            </span>
                        </div>
                    );
                };

                const renderCommentRow = (comment: EngagementComment, depth = 0) => {
                    const commentName = comment.username || comment.full_name || "Anonymous";
                    const commentAvatar = normalizeAssetUrl(comment.profile_picture);
                    const commentBody = comment.comment_text || comment.text || "No comment text";
                    const replies = Array.isArray((comment as any).replies) ? (comment as any).replies as EngagementComment[] : [];
                    return (
                        <div key={`${comment.id}-${depth}`} className={`${depth > 0 ? "ml-6 border-l border-white/8 pl-4" : ""}`}>
                            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-3 py-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                                        {commentAvatar ? (
                                            <img src={commentAvatar} alt={commentName} className="h-full w-full object-cover" />
                                        ) : (
                                            <IonIcon name="person-outline" className="text-sm text-white/45" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="truncate text-[12px] font-black text-white">{commentName}</p>
                                            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
                                                {formatRelativeSheetTime(comment.created_at)}
                                            </span>
                                        </div>
                                        <p className="mt-1 whitespace-pre-wrap text-[11px] font-semibold leading-5 text-white/80">
                                            {commentBody}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-white/35">
                                            <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/20 px-2 py-1">
                                                <IonIcon name="heart-outline" className="text-[10px] text-red-400" />
                                                {Number(comment.likes || 0)}
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/20 px-2 py-1">
                                                <IonIcon name="remove-circle-outline" className="text-[10px] text-sky-400" />
                                                {Number(comment.dislikes || 0)}
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/20 px-2 py-1">
                                                <IonIcon name="flag-outline" className="text-[10px] text-amber-300" />
                                                {Number(comment.reports || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {replies.length > 0 && (
                                <div className="mt-3 space-y-3">
                                    {replies.map((reply) => renderCommentRow(reply, depth + 1))}
                                </div>
                            )}
                        </div>
                    );
                };

                const getTabTitle = () => {
                    switch(engagementActiveTab) {
                        case "likes": return "LIKES";
                        case "comments": return "COMMENTS";
                        case "shares": return "SHARES";
                        case "views": return "VIEWS";
                        default: return "COMMENTS";
                    }
                };

                return (
                    <div className="fixed inset-0 z-[165] bg-black/60 backdrop-blur-sm" onClick={() => setEngagementDetailsId(null)}>
                        <div className="fixed bottom-4 left-1/2 z-[165] flex w-[calc(100%-1.5rem)] max-w-[430px] -translate-x-1/2 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] shadow-[0_-20px_60px_rgba(0,0,0,0.9)] animate-in slide-in-from-bottom-0 sm:bottom-6 sm:w-[92vw]" onClick={(event) => event.stopPropagation()}>
                            <div className="flex items-center justify-center pt-3">
                                <div className="h-1 w-12 rounded-full bg-white/20"></div>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
                                <div className="flex items-center justify-center gap-1.5 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => setEngagementActiveTab("likes")}
                                        className={`flex min-w-[64px] flex-col items-center justify-center gap-1 rounded-[1rem] px-2 py-2 transition ${engagementActiveTab === "likes" ? "bg-white/[0.08] opacity-100" : "opacity-35 hover:opacity-60"}`}
                                    >
                                        <IonIcon name="heart-outline" className="text-[18px] text-red-500" />
                                        <span className="text-[9px] font-black text-white/60">{engagementItem.likes_count || 0}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEngagementActiveTab("comments")}
                                        className={`flex min-w-[64px] flex-col items-center justify-center gap-1 rounded-[1rem] px-2 py-2 transition ${engagementActiveTab === "comments" ? "bg-white/[0.08] opacity-100" : "opacity-35 hover:opacity-60"}`}
                                    >
                                        <IonIcon name="chatbubble-outline" className="text-[18px] text-blue-500" />
                                        <span className="text-[9px] font-black text-white/60">{engagementItem.comments_count || 0}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEngagementActiveTab("shares")}
                                        className={`flex min-w-[64px] flex-col items-center justify-center gap-1 rounded-[1rem] px-2 py-2 transition ${engagementActiveTab === "shares" ? "bg-white/[0.08] opacity-100" : "opacity-35 hover:opacity-60"}`}
                                    >
                                        <IonIcon name="share-social-outline" className="text-[18px] text-yellow-500" />
                                        <span className="text-[9px] font-black text-white/60">{engagementItem.shares_count || 0}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEngagementActiveTab("views")}
                                        className={`flex min-w-[64px] flex-col items-center justify-center gap-1 rounded-[1rem] px-2 py-2 transition ${engagementActiveTab === "views" ? "bg-white/[0.08] opacity-100" : "opacity-35 hover:opacity-60"}`}
                                    >
                                        <IonIcon name="eye-outline" className="text-[18px] text-cyan-500" />
                                        <span className="text-[9px] font-black text-white/60">{engagementItem.views_count || 0}</span>
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEngagementDetailsId(null)}
                                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-white/50 transition hover:bg-white/[0.09] hover:text-white"
                                >
                                    <IonIcon name="close-outline" className="text-xl" />
                                </button>
                            </div>

                            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-white">{getTabTitle()}</h3>
                                    <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">
                                        {engagementItem.description ? engagementItem.description.substring(0, 25) : "CONTENT"}
                                    </p>
                                </div>
                            </div>

                            <div className="min-h-[150px] max-h-[44vh] overflow-y-auto px-4 py-4">
                                {engagementLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white/75" />
                                        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-white/45">
                                            Loading {engagementTitle}
                                        </p>
                                    </div>
                                ) : engagementError ? (
                                    <div className="rounded-[1.25rem] border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-[11px] font-bold text-rose-200">
                                        {engagementError}
                                    </div>
                                ) : engagementActiveTab === "comments" && structuredEngagementComments.length > 0 ? (
                                    <div className="space-y-3">
                                        {structuredEngagementComments.map((comment) => renderCommentRow(comment))}
                                    </div>
                                ) : engagementActiveTab !== "comments" && engagementRecords.length > 0 ? (
                                    <div className="space-y-3">
                                        {engagementRecords.map((actor, index) => renderActorRow(
                                            actor as EngagementActor,
                                            `${engagementActiveTab}-${String(actor.id ?? actor.user_id ?? 'record')}-${index}`,
                                        ))}
                                    </div>
                                ) : engagementActiveTab === "comments" ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-3">
                                            <IonIcon name="chatbubble-outline" className="text-3xl text-white/25" />
                                        </div>
                                        <p className="text-[12px] font-black uppercase tracking-[0.1em] text-white/50">NO COMMENTS YET — BE THE FIRST!</p>
                                    </div>
                                ) : engagementActiveTab === "likes" ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-3">
                                            <IonIcon name="heart-outline" className="text-3xl text-red-500/30" />
                                        </div>
                                        <p className="text-[12px] font-black uppercase tracking-[0.1em] text-white/50">
                                            {engagementItem.likes_count ? `${engagementItem.likes_count} LIKES` : "NO LIKES YET"}
                                        </p>
                                    </div>
                                ) : engagementActiveTab === "shares" ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-3">
                                            <IonIcon name="share-social-outline" className="text-3xl text-yellow-500/30" />
                                        </div>
                                        <p className="text-[12px] font-black uppercase tracking-[0.1em] text-white/50">
                                            {engagementItem.shares_count ? `${engagementItem.shares_count} SHARES` : "NOT SHARED YET"}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-3">
                                            <IonIcon name="eye-outline" className="text-3xl text-cyan-500/30" />
                                        </div>
                                        <p className="text-[12px] font-black uppercase tracking-[0.1em] text-white/50">
                                            {engagementItem.views_count ? `${engagementItem.views_count} VIEWS` : "NO VIEWS YET"}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-white/8 px-4 py-3">
                                {engagementActiveTab === "comments" ? (
                                    <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2.5">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/12 text-sky-400">
                                                <IonIcon name="chatbubble-outline" className="text-[15px]" />
                                            </span>
                                            <div className="min-w-0 flex-1 rounded-full border border-white/8 bg-black/20 px-3 py-2">
                                                <p className="truncate text-[10px] font-semibold text-white/40">
                                                    Comment thread preview from the main system
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 flex-wrap">
                                        <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/45">
                                            Live {engagementTitle} history
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
