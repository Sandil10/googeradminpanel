"use client";

import { useEffect, useMemo, useState } from "react";
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
    status: "Pending Approval" | "Approved" | "Rejected" | "Cancelled";
    username?: string | null;
    full_name?: string | null;
    profile_picture?: string | null;
    user_type?: string | null;
    rejection_reason?: string | null;
    admin_note?: string | null;
    created_at?: string | null;
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
};

const STATUS_TABS = [
    { key: "All Content", label: "All Content" },
    { key: "Pending Approval", label: "Under Review" },
    { key: "Approved", label: "Approved" },
    { key: "Rejected", label: "Rejected" },
    { key: "Cancelled", label: "Cancelled" },
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
    /\.(mp4|webm|ogg|mov|m4v|jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(value);

const normalizeAssetUrl = (value?: string | null) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;
    if (raw.startsWith("/")) return raw;
    const normalized = raw.replace(/\\/g, "/");
    const uploadIndex = normalized.toLowerCase().indexOf("uploads/");
    if (uploadIndex >= 0) {
        return `/${normalized.slice(uploadIndex)}`;
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

const isSupportAccount = (userType?: string | null) => {
    const normalized = String(userType || "").trim().toLowerCase().replace(/-/g, "_");
    return normalized === "super_admin" || normalized === "superadmin";
};

const normalizeExternalUrl = (value?: string | null) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

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
    const [form, setForm] = useState<UploadControlSettings>(DEFAULTS);
    const [uploadContents, setUploadContents] = useState<UploadContentRow[]>([]);
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [rejectingContentId, setRejectingContentId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [customRejectReason, setCustomRejectReason] = useState("");
    const [previewItem, setPreviewItem] = useState<UploadContentRow | null>(null);

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
        });
    };

    const loadContents = async () => {
        const contents = await adminService.fetchAdminUploadContents();
        setUploadContents(contents);
    };

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                setLoading(true);
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
                });
                setUploadContents(contentsResult || []);
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
        if (!query) return byStatus;
        return byStatus.filter((item) =>
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
    }, [activeStatus, search, uploadContents]);

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
    const commissionTierError = getTierValidationMessage(
        commissionTiers,
        minUploadPriceValue,
        maxUploadPriceValue,
        "commission"
    );
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
            await adminService.updateUploadContentStatus(contentId, {
                status,
                rejectionReason: status === "Rejected" ? finalRejectReason : undefined,
            });
            await loadContents();
            setMessage(`Upload content ${status === "Approved" ? "approved" : "rejected"}`);
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
                                const mediaType = String(item.media_type || "").toLowerCase();
                                const isPlayableVideo = mediaType === "video" || (item.content_type === "flash" && mediaType === "link");
                                const externalLink = String(item.external_link || "").trim();
                                const shouldBlurPreview = mediaType !== "link" && String(item.content_access_mode || "").toLowerCase() === "blurred";
                                const previewActionTarget = externalLink || previewSource;
                                const blurredPreviewSource = item.thumbnail_url || (mediaType === "link" ? getExternalPreviewSource(externalLink) : "") || previewSource;
                                const reviewNote = item.rejection_reason || item.admin_note || "No rejection note. This content is waiting for review or already approved.";
                                const visibilityMeta = getVisibilityMeta(item.visibility);
                                const subscriptionPackages = Array.isArray(item.subscription_packages) ? item.subscription_packages : [];
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
                                                {(activeStatus === "Pending Approval" || activeStatus === "All Content") && (
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
                                                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Created</p>
                                                            <p className="mt-1 text-[11px] font-bold text-white">{formatColomboDateTime(item.created_at)}</p>
                                                        </div>
                                                    </div>

                                                    {subscriptionPackages.length > 0 && (
                                                        <div className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.03] p-3">
                                                            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35">Enabled Packages</p>
                                                            <div className="mt-2 space-y-2">
                                                                {subscriptionPackages.map((pkg, index) => (
                                                                    <div key={pkg.id || `${contentId}-pkg-${index}`} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[10px] font-bold text-white/75">
                                                                        <span>Package {index + 1}</span>
                                                                        <span>Rupier {Number(pkg.price || 0).toLocaleString()} / {formatPackageDuration(Number(pkg.days || 0))}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="w-full max-w-[220px] rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-3">
                                                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35">
                                                            {getPreviewLabel(item)}
                                                        </p>
                                                        <div className="relative mt-2 flex h-[116px] items-center justify-center overflow-hidden rounded-[0.95rem] border border-white/10 bg-black/40">
                                                            {shouldBlurPreview && blurredPreviewSource ? (
                                                                <img
                                                                    src={blurredPreviewSource}
                                                                    alt={`${mediaType || "media"} preview`}
                                                                    className="h-full w-full scale-110 object-cover blur-xl"
                                                                />
                                                            ) : previewSource ? (
                                                                mediaType === "video" && isVideoUrl(previewSource) ? (
                                                                    <video
                                                                        src={previewSource}
                                                                        muted
                                                                        autoPlay={item.preview_mode === "auto_preview"}
                                                                        playsInline
                                                                        preload="metadata"
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <img
                                                                        src={previewSource}
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
                    <div className="mt-5 rounded-[1.4rem] border border-amber-300/15 bg-amber-400/10 p-4">
                        <div className="mb-4 flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-300/10 text-amber-100">
                                <IonIcon name="flash-outline" className="text-lg" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/70">Flash Content Settings</p>
                                <p className="mt-1 text-[13px] text-white/50">Flash uses one admin price and one preview duration. Users cannot edit price, add commissions, or add subscription packages.</p>
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Flash Content Price</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.flash_content_price}
                                    onChange={(event) => setForm((current) => ({ ...current, flash_content_price: Number(event.target.value) }))}
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-[13px] font-semibold text-white outline-none transition focus:border-amber-200/30 focus:bg-white/[0.05]"
                                />
                            </label>
                            <label className="space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Preview Time (seconds)</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.flash_preview_seconds}
                                    onChange={(event) => setForm((current) => ({ ...current, flash_preview_seconds: Number(event.target.value) }))}
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-[13px] font-semibold text-white outline-none transition focus:border-amber-200/30 focus:bg-white/[0.05]"
                                />
                            </label>
                            <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 md:col-span-2">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Flash Content Auto Play</p>
                                    <p className="mt-1 text-[12px] font-semibold text-white/45">When enabled, Flash Content videos start playing automatically in the feed.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setForm((current) => ({ ...current, flash_auto_play: !current.flash_auto_play }))}
                                    className={`relative h-7 w-12 rounded-full border transition ${form.flash_auto_play ? "border-amber-200/40 bg-amber-300" : "border-white/10 bg-white/[0.08]"}`}
                                    aria-pressed={form.flash_auto_play}
                                    aria-label="Toggle flash content autoplay"
                                >
                                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${form.flash_auto_play ? "left-6" : "left-1"}`} />
                                </button>
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
                            {commissionTierError && (
                                <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[11px] font-bold text-rose-200">
                                    {commissionTierError}
                                </div>
                            )}
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
                const modalExternalLink = normalizeExternalUrl(previewItem.external_link);
                const modalSource = modalExternalLink && (modalMediaType === "video" || modalMediaType === "link")
                    ? modalExternalLink
                    : modalMediaType === "link" ? modalExternalLink : modalPreviewSource;
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
                                    <video src={modalSource} poster={normalizeAssetUrl(previewItem.thumbnail_url) || undefined} controls autoPlay className="max-h-[65vh] w-full rounded-xl object-contain" />
                                ) : modalEmbedSource ? (
                                    <iframe
                                        src={modalEmbedSource}
                                        title="Linked video content"
                                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                                        allowFullScreen
                                        className="aspect-video max-h-[65vh] w-full rounded-xl border-0 bg-black"
                                    />
                                ) : (
                                    <img src={modalSource} alt="Uploaded content preview" className="max-h-[65vh] w-full rounded-xl object-contain" />
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
        </div>
    );
}
