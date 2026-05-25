"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import { adService } from "@/services/adService";

type AdStatus = "Under Review" | "Active" | "Paused" | "Completed" | "Cancelled";
type StatusFilter = "All Ads" | AdStatus;
const ADS_PER_PAGE = 5;

interface AdRecord {
    id: number;
    ad_id: string;
    user_id: number;
    owner_user_id?: string;
    owner_username?: string;
    full_name?: string;
    profile_picture?: string;
    campaign_type?: string;
    title?: string;
    description?: string;
    media_preview?: string;
    media_type?: string;
    gender_target?: string;
    age_min?: number;
    age_max?: number;
    reach?: number;
    impressions?: number;
    clicks?: number;
    budget?: string | number;
    duration_days?: number;
    spend?: string | number;
    remaining_budget?: string | number;
    status?: string;
    campaign_path?: string;
    wallet_transfer_id?: number;
    rejection_reason?: string | null;
    rejection_note?: string | null;
    edit_draft?: any;
    created_at?: string;
    updated_at?: string;
    approved_at?: string;
}

type AdHistoryRow = {
    id: number;
    adId: string;
    campaignType: string;
    createdAt: string;
    updatedAt?: string;
    approvedAt?: string;
    ownerId: number;
    ownerKey?: string;
    ownerName?: string;
    ownerGoogerId?: string;
    status: AdStatus;
    budget?: number;
    durationDays?: number;
    title?: string;
    description?: string;
    mediaPreview?: string;
    mediaType?: "image" | "video" | "link" | "";
    genderTarget?: string;
    ageMin?: number;
    ageMax?: number;
    reach?: number;
    impressions?: number;
    clicks?: number;
    spend?: number;
    remainingBudget?: number;
    campaignPath?: string;
    rejectionReason?: string;
    rejectionNote?: string;
    editDraft?: Record<string, unknown>;
};

interface ConfirmDialog {
    open: boolean;
    adId: string | null;
    nextStatus: AdStatus;
    title: string;
    message: string;
    confirmLabel: string;
    confirmClass: string;
}

interface RejectDialog {
    open: boolean;
    adId: string | null;
    reason: string;
    note: string;
}

const STATUS_FILTERS: Array<{ label: StatusFilter; slug: string; icon: string }> = [
    { label: "All Ads", slug: "all", icon: "receipt-outline" },
    { label: "Under Review", slug: "under-review", icon: "time-outline" },
    { label: "Active", slug: "active", icon: "radio-button-on-outline" },
    { label: "Paused", slug: "paused", icon: "pause-circle-outline" },
    { label: "Completed", slug: "completed", icon: "checkmark-done-outline" },
    { label: "Cancelled", slug: "cancelled", icon: "close-circle-outline" },
];

const VALID_STATUSES: AdStatus[] = ["Under Review", "Active", "Paused", "Completed", "Cancelled"];
const REJECTION_REASONS = [
    "Policy Violation",
    "Incomplete Ad Details",
    "Restricted / Unsupported Content",
];
// Asia/Colombo = UTC+5:30 (manually applied so no Intl/ICU timezone dependency)
const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatInColombo(utcMs: number): string {
    const d = new Date(utcMs + COLOMBO_OFFSET_MS);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = MONTH_SHORT[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const rawH = d.getUTCHours();
    const hh = String(rawH % 12 || 12).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    const ss = String(d.getUTCSeconds()).padStart(2, "0");
    const ampm = rawH >= 12 ? "pm" : "am";
    return `${day} ${month} ${year}, ${hh}:${mm}:${ss} ${ampm}`;
}

function normalizeStatus(status: unknown): AdStatus {
    const raw = String(status || "").trim();
    if (VALID_STATUSES.includes(raw as AdStatus)) return raw as AdStatus;

    const normalized = raw.toLowerCase().replace(/[_-]+/g, " ");
    if (normalized === "approved" || normalized === "active") return "Active";
    if (normalized === "paused" || normalized === "pause") return "Paused";
    if (normalized === "completed" || normalized === "complete" || normalized === "expired") return "Completed";
    if (normalized === "cancelled" || normalized === "canceled" || normalized === "rejected" || normalized === "removed" || normalized === "deleted") return "Cancelled";
    if (normalized === "under review" || normalized === "pending" || normalized === "pending approval" || normalized === "review") return "Under Review";

    return "Under Review";
}

function parseJsonField(value: any) {
    if (!value) return null;
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function toUtcIso(val: unknown): string {
    if (!val) return new Date().toISOString();
    // PostgreSQL TIMESTAMP returns "2026-05-21 07:35:51" — replace space with T, append Z
    const s = String(val).trim().replace(" ", "T");
    const withTz = s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s) ? s : s + "Z";
    const d = new Date(withTz);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeApiAds(input: AdRecord[]) {
    return input
        .map((data): AdHistoryRow => ({
            id: data.id,
            adId: typeof data.ad_id === "string" ? data.ad_id : "",
            campaignType: typeof data.campaign_type === "string" ? data.campaign_type : "Ad Campaign",
            createdAt: toUtcIso(data.created_at),
            updatedAt: data.updated_at ? toUtcIso(data.updated_at) : undefined,
            approvedAt: data.approved_at ? toUtcIso(data.approved_at) : undefined,
            ownerId: Number(data.user_id || 0),
            ownerKey: typeof data.owner_username === "string" ? data.owner_username : undefined,
            ownerName: typeof data.full_name === "string" ? data.full_name : undefined,
            ownerGoogerId: typeof data.owner_user_id === "string" ? data.owner_user_id : data.owner_user_id ? String(data.owner_user_id) : undefined,
            status: normalizeStatus(data.status),
            budget: Number(data.budget || 0),
            durationDays: Number(data.duration_days || 0),
            title: typeof data.title === "string" ? data.title : undefined,
            description: typeof data.description === "string" ? data.description : undefined,
            mediaPreview: typeof data.media_preview === "string" ? data.media_preview : undefined,
            mediaType: ["image", "video", "link", ""].includes(String(data.media_type || "")) ? (String(data.media_type || "") as "image" | "video" | "link" | "") : "",
            genderTarget: typeof data.gender_target === "string" ? data.gender_target : undefined,
            ageMin: Number.isFinite(Number(data.age_min)) ? Number(data.age_min) : undefined,
            ageMax: Number.isFinite(Number(data.age_max)) ? Number(data.age_max) : undefined,
            reach: Number(data.reach || 0),
            impressions: Number(data.impressions || 0),
            clicks: Number(data.clicks || 0),
            spend: Number(data.spend || 0),
            remainingBudget: Number(data.remaining_budget || 0),
            campaignPath: typeof data.campaign_path === "string" ? data.campaign_path : undefined,
            rejectionReason: typeof data.rejection_reason === "string" ? data.rejection_reason : undefined,
            rejectionNote: typeof data.rejection_note === "string" ? data.rejection_note : undefined,
            editDraft: parseJsonField(data.edit_draft) || undefined,
        }))
        .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
}

function formatDateTime(value: string) {
    const utcMs = new Date(value).getTime();
    if (!isNaN(utcMs)) return formatInColombo(utcMs);
    return value;
}

function formatCurrency(value?: number) {
    return `R ${Number(value || 0).toLocaleString()}`;
}

function parseAdDate(value?: string | null) {
    if (!value) return null;
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatExactDateTime(value?: string | Date | null) {
    const d = value instanceof Date ? value : parseAdDate(value);
    if (!d) return "Not available";
    return formatInColombo(d.getTime());
}

function getAdCreatedDate(ad: AdHistoryRow) {
    return parseAdDate(ad.createdAt);
}

function getAdStartDate(ad: AdHistoryRow) {
    if (ad.status === "Under Review") return null;
    // Use the stored approval time so completion/cancel updates do not reset the ad timer.
    return ad.approvedAt ? parseAdDate(ad.approvedAt) : ad.updatedAt ? parseAdDate(ad.updatedAt) : getAdCreatedDate(ad);
}

function getAdEndDate(ad: AdHistoryRow) {
    const startDate = getAdStartDate(ad);
    if (!startDate || !ad.durationDays || ad.durationDays <= 0) return null;

    const endDate = new Date(startDate.getTime() + ad.durationDays * 24 * 60 * 60 * 1000);
    return endDate;
}

function formatRemainingTime(ad: AdHistoryRow, nowMs: number) {
    if (ad.status === "Under Review") return "Starts after approval";
    if (ad.status === "Completed") return "Completed";
    if (ad.status === "Cancelled") return "Cancelled";

    const endDate = getAdEndDate(ad);
    if (!endDate) return "Not set";

    const diffMs = endDate.getTime() - nowMs;
    if (diffMs <= 0) return "Ended";

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function getStartTimeLabel(ad: AdHistoryRow) {
    const startDate = getAdStartDate(ad);
    return startDate ? formatExactDateTime(startDate) : "Starts after approval";
}

function getEndTimeLabel(ad: AdHistoryRow) {
    const endDate = getAdEndDate(ad);
    return endDate ? formatExactDateTime(endDate) : "Not set";
}

function formatSpend(value?: number | string) {
    const amount = Number(value || 0);
    if (amount === 0) return <span className="text-white/45">R 0</span>;
    return <span className="text-red-400">-R {amount.toLocaleString()}</span>;
}

function formatReachCount(value: number) {
    return Number(value || 0).toLocaleString();
}

function cleanAdText(value?: string) {
    if (!value) return "";
    const normalized = value.trim();
    if (!normalized) return "";
    if (normalized.toLowerCase() === "no link added yet") return "";
    return normalized;
}

function getAgeLabel(ad: AdHistoryRow) {
    if (typeof ad.ageMin === "number" && typeof ad.ageMax === "number") return `${ad.ageMin}-${ad.ageMax}`;
    return "All";
}

function getTitle(ad: AdHistoryRow) {
    return cleanAdText(ad.title) || cleanAdText(ad.description) || ad.campaignType;
}

function getEstimatedReachLabel(ad: AdHistoryRow) {
    const budget = Number(ad.budget || 0);
    const minReach = Math.round((budget / 100) * 300);
    const maxReach = Math.round((budget / 100) * 500);
    return `${formatReachCount(minReach)} - ${formatReachCount(maxReach)}`;
}

function getLocationLabel(ad: AdHistoryRow) {
    const rawLocations = ad.editDraft && Array.isArray((ad.editDraft as { selectedLocationCodes?: unknown[] }).selectedLocationCodes)
        ? (((ad.editDraft as { selectedLocationCodes?: unknown[] }).selectedLocationCodes) || []).filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];

    if (rawLocations.length === 0) return "No location";
    if (rawLocations.length <= 2) return rawLocations.join(", ");
    return `${rawLocations.slice(0, 2).join(", ")} +${rawLocations.length - 2}`;
}

function getStatusClasses(status: AdStatus) {
    if (status === "Under Review") return "border-amber-400/25 bg-amber-400/10 text-amber-200";
    if (status === "Active") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
    if (status === "Paused") return "border-sky-400/25 bg-sky-400/10 text-sky-200";
    if (status === "Completed") return "border-violet-400/25 bg-violet-400/10 text-violet-200";
    return "border-rose-400/25 bg-rose-400/10 text-rose-200";
}

function normalizeUrl(value?: string) {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getCtaConfig(ad: AdHistoryRow) {
    const draft = ad.editDraft as {
        ctaTopic?: string;
        ctaValue?: string;
        activeLink?: string;
        linkInput?: string;
    } | undefined;

    const label = typeof draft?.ctaTopic === "string" ? draft.ctaTopic.trim() : "";
    const rawValue = typeof draft?.ctaValue === "string" && draft.ctaValue.trim()
        ? draft.ctaValue.trim()
        : typeof draft?.activeLink === "string" && draft.activeLink.trim()
            ? draft.activeLink.trim()
            : typeof draft?.linkInput === "string"
                ? draft.linkInput.trim()
                : "";

    if (!label || label === "No Button") {
        return { label: "", href: "", detail: "" };
    }

    if (label === "Message") {
        return { label, href: "", detail: "Message CTA" };
    }

    if (label === "Call Now") {
        const digits = rawValue.replace(/[^\d+]/g, "");
        return { label, href: digits ? `tel:${digits}` : "", detail: rawValue };
    }

    if (label === "WhatsApp") {
        const normalized = rawValue.startsWith("http") ? rawValue : rawValue.replace(/\D/g, "");
        const href = rawValue.startsWith("http") ? rawValue : (normalized ? `https://wa.me/${normalized}` : "");
        return { label, href, detail: rawValue };
    }

    return { label, href: normalizeUrl(rawValue), detail: rawValue };
}

export default function AdsTable() {
    const pathname = usePathname();
    const [ads, setAds] = useState<AdHistoryRow[]>([]);
    const [activeFilter, setActiveFilter] = useState<StatusFilter>("Under Review");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedAd, setSelectedAd] = useState<AdHistoryRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
        open: false,
        adId: null,
        nextStatus: "Active",
        title: "",
        message: "",
        confirmLabel: "",
        confirmClass: "",
    });
    const [rejectDialog, setRejectDialog] = useState<RejectDialog>({
        open: false,
        adId: null,
        reason: REJECTION_REASONS[0],
        note: "",
    });
    const [coinMessage, setCoinMessage] = useState<string | null>(null);
    const [coinLoading, setCoinLoading] = useState(false);
    const [nowTick, setNowTick] = useState(() => Date.now());
    const [mediaModal, setMediaModal] = useState<{ src: string; type: "image" | "video"; title: string } | null>(null);
    const [approvalDurationDays, setApprovalDurationDays] = useState<number | null>(null);

    const loadAds = async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const nextAds = await adminService.fetchAllAds();
            setAds(normalizeApiAds(Array.isArray(nextAds) ? nextAds : []));
            setError(null);
        } catch (err: any) {
            console.error(err);
            if (!isPolling) setError(err.message || "Failed to load ads");
            if (!isPolling) setAds([]);
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    useEffect(() => {
        loadAds(false);
        const interval = setInterval(() => loadAds(true), 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => setNowTick(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setCoinMessage(null);
    }, [selectedAd?.adId]);

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredAds = (activeFilter === "All Ads" ? ads : ads.filter((ad) => ad.status === activeFilter))
        .filter((ad) => {
            if (!normalizedSearch) return true;
            const haystack = [
                ad.adId,
                getTitle(ad),
                ad.ownerGoogerId,
                ad.ownerKey,
                ad.ownerName,
            ].map((value) => String(value || "").toLowerCase());

            return haystack.some((value) => value.includes(normalizedSearch));
        });
    const totalPages = Math.max(1, Math.ceil(filteredAds.length / ADS_PER_PAGE));
    const paginatedAds = filteredAds.slice((currentPage - 1) * ADS_PER_PAGE, currentPage * ADS_PER_PAGE);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeFilter, searchQuery]);

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

    const counts = useMemo(
        () =>
            STATUS_FILTERS.reduce<Record<StatusFilter, number>>((result, filter) => {
                result[filter.label] = filter.label === "All Ads" ? ads.length : ads.filter((ad) => ad.status === filter.label).length;
                return result;
            }, {} as Record<StatusFilter, number>),
        [ads]
    );

    const openStatusPage = (filter: (typeof STATUS_FILTERS)[number]) => {
        setActiveFilter(filter.label);
        setCurrentPage(1);
    };

    const openRejectDialog = (adId: string) => {
        setRejectDialog({
            open: true,
            adId,
            reason: REJECTION_REASONS[0],
            note: "",
        });
    };

    const openConfirm = (adId: string, nextStatus: AdStatus) => {
        const currentStatus = ads.find((ad) => ad.adId === adId)?.status;
        const configs: Record<AdStatus, Omit<ConfirmDialog, "open" | "adId" | "nextStatus">> = {
            "Under Review": {
                title: "Move Ad to Review",
                message: "This ad will be moved back to under review.",
                confirmLabel: "Move to Review",
                confirmClass: "bg-amber-600 hover:bg-amber-500 text-white",
            },
            Active: {
                title: currentStatus === "Paused" ? "Unpause Ad" : "Approve Ad",
                message: currentStatus === "Paused"
                    ? "This ad will start showing again in the Home Feed and Shop Feed."
                    : "This ad will move to active immediately.",
                confirmLabel: currentStatus === "Paused" ? "Unpause Ad" : "Approve",
                confirmClass: "bg-emerald-600 hover:bg-emerald-500 text-white",
            },
            Paused: {
                title: "Pause Ad",
                message: "This ad will stop showing in the Home Feed and Shop Feed until it is unpaused.",
                confirmLabel: "Pause Ad",
                confirmClass: "bg-sky-600 hover:bg-sky-500 text-white",
            },
            Completed: {
                title: "Mark Completed",
                message: "This ad will be marked as completed and will not return to approval.",
                confirmLabel: "Mark Completed",
                confirmClass: "bg-violet-600 hover:bg-violet-500 text-white",
            },
            Cancelled: {
                title: "Cancel Ad",
                message: "This ad will be moved to cancelled.",
                confirmLabel: "Cancel Ad",
                confirmClass: "bg-rose-600 hover:bg-rose-500 text-white",
            },
        };

        setConfirmDialog({ open: true, adId, nextStatus, ...configs[nextStatus] });
        setApprovalDurationDays(null);
    };

    const handleConfirmedAction = async () => {
        if (!confirmDialog.adId) return;
        setIsProcessing(true);
        try {
            const opts: { rejectionReason?: string; rejectionNote?: string; durationDays?: number } =
                confirmDialog.nextStatus === "Cancelled"
                    ? { rejectionReason: "Cancelled by Admin", rejectionNote: "Cancelled by Admin" }
                    : {};
            if (confirmDialog.nextStatus === "Active" && approvalDurationDays !== null) {
                opts.durationDays = approvalDurationDays;
            }
            await adminService.updateAdStatus(confirmDialog.adId, confirmDialog.nextStatus, opts);
            const currentAd = ads.find((ad) => ad.adId === confirmDialog.adId);
            const approvalTimeOverride = confirmDialog.nextStatus === "Active" && (!currentAd?.approvedAt || currentAd.status === "Under Review")
                ? { approvedAt: new Date().toISOString() }
                : {};
            const durationOverride = confirmDialog.nextStatus === "Active" && approvalDurationDays !== null
                ? { durationDays: approvalDurationDays }
                : {};
            setAds((prev) => prev.map((ad) => (
                ad.adId === confirmDialog.adId ? { ...ad, status: confirmDialog.nextStatus, ...approvalTimeOverride, ...durationOverride } : ad
            )));
            if (selectedAd?.adId === confirmDialog.adId) {
                setSelectedAd({ ...selectedAd, status: confirmDialog.nextStatus, ...approvalTimeOverride, ...durationOverride });
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsProcessing(false);
            setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
    };

    const handleRejectedAction = async () => {
        if (!rejectDialog.adId) return;

        const customNote = rejectDialog.note.trim();
        const rejectionReason = customNote || rejectDialog.reason;

        if (!rejectionReason) {
            alert("Please select or enter a rejection reason.");
            return;
        }

        setIsProcessing(true);
        try {
            await adminService.updateAdStatus(rejectDialog.adId, "Cancelled", {
                rejectionReason,
                rejectionNote: customNote || rejectDialog.reason,
            });
            setAds((prev) => prev.map((ad) => (
                ad.adId === rejectDialog.adId
                    ? {
                        ...ad,
                        status: "Cancelled",
                        rejectionReason,
                        rejectionNote: customNote || rejectDialog.reason,
                        remainingBudget: 0,
                    }
                    : ad
            )));
            if (selectedAd?.adId === rejectDialog.adId) {
                setSelectedAd({
                    ...selectedAd,
                    status: "Cancelled",
                    rejectionReason,
                    rejectionNote: customNote || rejectDialog.reason,
                    remainingBudget: 0,
                });
            }
            setRejectDialog({ open: false, adId: null, reason: REJECTION_REASONS[0], note: "" });
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCollectCoin = async () => {
        if (!selectedAd) return;
        setCoinLoading(true);
        try {
            const result = await adService.collectCoin(selectedAd.adId);
            setCoinMessage(result?.message || "Coin collected successfully");
        } catch (err: any) {
            setCoinMessage(err.message || "Failed to collect coin");
        } finally {
            setCoinLoading(false);
        }
    };

    return (
        <div className="min-h-screen pb-10">
            <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Ad Center</p>
            </div>

            {error && !loading && (
                <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <IonIcon name="warning-outline" className="shrink-0 text-xl text-rose-400" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-rose-400">Failed to load ads</p>
                            <p className="mt-0.5 text-xs font-medium text-rose-300/70">{error}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => loadAds(false)}
                        className="h-8 rounded-xl border border-rose-500/30 bg-rose-500/20 px-4 text-[9px] font-black uppercase tracking-widest text-rose-400 transition-all hover:bg-rose-500/30"
                    >
                        Retry
                    </button>
                </div>
            )}

            <div className="mb-8 flex items-center gap-2">
                <button
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-700/50 bg-gray-800/40 text-white transition-all shadow-lg active:scale-95 hover:bg-gray-700/60 md:hidden"
                    onClick={() => document.getElementById("admin-adcenter-scroll")?.scrollBy({ left: -150, behavior: "smooth" })}
                >
                    <IonIcon name="chevron-back" className="text-lg" />
                </button>
                <div
                    id="admin-adcenter-scroll"
                    className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/5 bg-white/5 p-1 scroll-smooth md:flex-none"
                >
                    {STATUS_FILTERS.map((tab) => (
                        <button
                            key={tab.label}
                            onClick={() => openStatusPage(tab)}
                            className={`flex min-w-[150px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all sm:min-w-[170px] md:w-44 md:flex-none ${
                                activeFilter === tab.label ? "scale-[1.02] bg-white text-black shadow-lg shadow-white/5" : "text-slate-500 hover:bg-white/5 hover:text-white"
                            }`}
                        >
                            <IonIcon name={tab.icon} className="text-sm" />
                            {tab.label}
                            <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                                activeFilter === tab.label ? "bg-black/10 text-black" : "bg-white/5 text-white/70"
                            }`}>
                                {counts[tab.label] || 0}
                            </span>
                        </button>
                    ))}
                </div>
                <button
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-700/50 bg-gray-800/40 text-white transition-all shadow-lg active:scale-95 hover:bg-gray-700/60 md:hidden"
                    onClick={() => document.getElementById("admin-adcenter-scroll")?.scrollBy({ left: 150, behavior: "smooth" })}
                >
                    <IonIcon name="chevron-forward" className="text-lg" />
                </button>
            </div>

            <div className="mb-6">
                <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 py-3">
                    <IonIcon name="search-outline" className="text-lg text-white/45" />
                    <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search by Ad ID, Ad Name, or Googer ID"
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

            <div className="space-y-5">
                {loading ? (
                    <div className="flex min-h-[260px] items-center justify-center rounded-[2rem] border border-white/8 bg-[#070707]">
                        <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-white" />
                    </div>
                ) : paginatedAds.length > 0 ? (
                    paginatedAds.map((ad) => {
                        const cta = getCtaConfig(ad);

                        return (
                            <article key={ad.adId} className="overflow-hidden rounded-[2rem] border border-white/8 bg-[#1a1614] shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                                <div className="flex flex-col gap-4 border-b border-white/6 px-4 py-4 sm:px-5 md:px-6 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/50">
                                            <IonIcon name="megaphone-outline" className="text-lg" />
                                        </div>
                                        <div>
                                            <h2 className="text-[15px] font-black tracking-[0.04em] text-white">Ad ID: {ad.adId.slice(-10) || ad.adId}</h2>
                                            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] text-white/35">
                                                {ad.campaignType} • {formatDateTime(ad.createdAt)}
                                            </p>
                                            <Link
                                                href={`/admin/users/${ad.ownerId}?returnTo=${pathname}&from=Ads`}
                                                className="mt-1 block text-[10px] font-bold text-white/70 transition-colors hover:text-white"
                                            >
                                                {ad.ownerName || ad.ownerKey || "Unknown User"}{ad.ownerGoogerId ? ` • Googer ID ${ad.ownerGoogerId}` : ""}
                                            </Link>
                                        </div>
                                    </div>
                                        <div className="flex items-center justify-between gap-3 lg:justify-end">
                                            <div className="text-left lg:text-right">
                                            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">Total Budget</p>
                                            <p className="mt-1 text-[1.35rem] font-black tracking-tight text-white">{formatCurrency(ad.budget)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedAd(ad)}
                                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white"
                                        >
                                            <IonIcon name="eye-outline" className="text-base" />
                                        </button>
                                    </div>
                                </div>

                                <div className="px-4 py-4 sm:px-5 md:px-6">
                                    <div className="grid gap-3 rounded-[1.5rem] border border-white/6 bg-[#121212] p-3 xl:grid-cols-[1.75fr_0.3fr]">
                                        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                                            <div
                                                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[1rem] bg-black/25 group ${ad.mediaPreview ? "cursor-pointer" : ""}`}
                                                onClick={() => ad.mediaPreview && setMediaModal({ src: ad.mediaPreview, type: ad.mediaType === "video" ? "video" : "image", title: getTitle(ad) })}
                                            >
                                                {ad.mediaType === "video" && ad.mediaPreview ? (
                                                    <video src={ad.mediaPreview} className="h-full w-full object-cover" muted playsInline />
                                                ) : ad.mediaPreview ? (
                                                    <img src={ad.mediaPreview} alt={getTitle(ad)} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-white/30">
                                                        <IonIcon name={ad.mediaType === "video" ? "videocam-outline" : "image-outline"} className="text-3xl" />
                                                    </div>
                                                )}
                                                {ad.mediaPreview && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <IonIcon name={ad.mediaType === "video" ? "play-circle-outline" : "expand-outline"} className="text-2xl text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="truncate text-[0.95rem] font-black uppercase leading-none text-white">{getTitle(ad)}</h3>
                                                    <span className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] ${getStatusClasses(ad.status)}`}>
                                                        {ad.status}
                                                    </span>
                                                </div>
                                                <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-4 text-white/58">{cleanAdText(ad.description) || "No description added."}</p>
                                                <div className="mt-1.5 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.08em] text-white/34">
                                                    <IonIcon name="location-outline" className="text-[11px]" />
                                                    <span className="truncate">{getLocationLabel(ad)}</span>
                                                </div>
                                                {cta.label && (
                                                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                                        {cta.href ? (
                                                            <a
                                                                href={cta.href}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-black transition hover:bg-white/90"
                                                            >
                                                                {cta.label}
                                                            </a>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-black">
                                                                {cta.label}
                                                            </span>
                                                        )}
                                                        <span className="truncate text-[9px] font-semibold text-white/45">
                                                            {cta.detail || "No CTA link attached"}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-start gap-2 xl:flex-col xl:justify-center xl:justify-self-end">
                                            {ad.status === "Under Review" ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => openConfirm(ad.adId, "Active")}
                                                        className="inline-flex min-w-[96px] items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-emerald-300 transition hover:bg-emerald-500/20"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openRejectDialog(ad.adId)}
                                                        className="inline-flex min-w-[96px] items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-rose-300 transition hover:bg-rose-500/20"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            ) : ad.status === "Active" || ad.status === "Paused" ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => openConfirm(ad.adId, ad.status === "Paused" ? "Active" : "Paused")}
                                                        className={`inline-flex min-w-[96px] items-center justify-center rounded-xl border px-3 py-2 text-[8px] font-black uppercase tracking-[0.08em] transition ${
                                                            ad.status === "Paused"
                                                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                                                : "border-sky-500/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                                                        }`}
                                                    >
                                                        {ad.status === "Paused" ? "Unpause" : "Pause"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openRejectDialog(ad.adId)}
                                                        className="inline-flex min-w-[96px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-white/70 transition hover:bg-white/[0.09] hover:text-white"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="inline-flex min-w-[96px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-white/45">
                                                    {ad.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-2 lg:grid-cols-2 2xl:grid-cols-[1.15fr_0.85fr_0.85fr]">
                                        <div className="rounded-[0.95rem] border border-white/8 bg-[#0b0b0b] p-2">
                                            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/38">Order Summary</p>
                                            <div className="mt-2 grid gap-1 text-[9px] font-black text-white">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Total Budget</span>
                                                    <span>Rupieer {Number(ad.budget || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Duration</span>
                                                    <span>{ad.durationDays || 0} {ad.durationDays === 1 ? "day" : "days"}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Age</span>
                                                    <span>{getAgeLabel(ad)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Gender</span>
                                                    <span>{ad.genderTarget || "All"}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-1">
                                                    <span className="text-white/55">Estimated Reach</span>
                                                    <span>{getEstimatedReachLabel(ad)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-[0.95rem] border border-white/8 bg-[#0b0b0b] p-2">
                                            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/38">Ad Performance</p>
                                            <div className="mt-2 grid gap-1 text-[9px] font-black text-white">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Reach</span>
                                                    <span>{ad.reach || 0}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Impressions</span>
                                                    <span>{ad.impressions || 0}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Clicks</span>
                                                    <span>{ad.clicks || 0}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-1">
                                                    <span className="text-white/55">Ad Start Time</span>
                                                    <span className="text-right">{getStartTimeLabel(ad)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Ad End Time</span>
                                                    <span className="text-right">{getEndTimeLabel(ad)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Remaining Time</span>
                                                    <span className="text-right">{formatRemainingTime(ad, nowTick)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-[0.95rem] border border-white/8 bg-[#0b0b0b] p-2">
                                            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/38">Budget</p>
                                            <div className="mt-2 grid gap-1 text-[9px] font-black text-white">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Budget</span>
                                                    <span>{formatCurrency(ad.budget)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Spend</span>
                                                    {formatSpend(ad.spend)}
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-white/55">Remaining</span>
                                                    <span>{formatCurrency(ad.remainingBudget)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-1">
                                                    <span className="text-white/55">Status</span>
                                                    <span className="text-[8px] uppercase tracking-[0.08em] text-white/85">{ad.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })
                ) : (
                    <div className="rounded-[2rem] border border-dashed border-white/10 bg-[#070707] px-6 py-20 text-center">
                        <IonIcon name="megaphone-outline" className="mx-auto mb-4 text-5xl text-white/15" />
                        <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/34">
                            {searchQuery ? "No ads match this search" : "No ads in this section"}
                        </p>
                    </div>
                )}
            </div>

            {filteredAds.length > ADS_PER_PAGE && (
                <div className="mt-6 flex items-center justify-center gap-3">
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

            {selectedAd && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4">
                    <button
                        type="button"
                        onClick={() => setSelectedAd(null)}
                        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                        aria-label="Close ad summary"
                    />
                    <div className="relative z-[121] flex max-h-[86vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#121212] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
                        <div className="flex items-start justify-between border-b border-white/6 px-4 py-4 sm:px-5">
                            <div>
                                <h2 className="text-[1.35rem] font-black uppercase tracking-[0.04em] text-white">Ad Summary</h2>
                                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/30">Ad ID: {selectedAd.adId.slice(-10) || selectedAd.adId}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedAd(null)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/45 transition hover:bg-white/[0.1] hover:text-white"
                            >
                                <IonIcon name="close-outline" className="text-lg" />
                            </button>
                        </div>

                        <div className="space-y-5 overflow-y-auto px-3 py-3 sm:px-5 sm:py-5">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/28">Purchased Ad</p>
                                    <div className="mt-3 rounded-[1.35rem] border border-white/8 bg-white/[0.04] p-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <div
                                            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[0.9rem] bg-black/25 sm:h-16 sm:w-16 group ${selectedAd.mediaPreview ? "cursor-pointer" : ""}`}
                                            onClick={() => selectedAd.mediaPreview && setMediaModal({ src: selectedAd.mediaPreview, type: selectedAd.mediaType === "video" ? "video" : "image", title: getTitle(selectedAd) })}
                                        >
                                            {selectedAd.mediaType === "video" && selectedAd.mediaPreview ? (
                                                <video src={selectedAd.mediaPreview} className="h-full w-full object-cover" muted playsInline />
                                            ) : selectedAd.mediaPreview ? (
                                                <img src={selectedAd.mediaPreview} alt={getTitle(selectedAd)} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-white/30">
                                                    <IonIcon name={selectedAd.mediaType === "video" ? "videocam-outline" : "image-outline"} className="text-3xl" />
                                                </div>
                                            )}
                                            {selectedAd.mediaPreview && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <IonIcon name={selectedAd.mediaType === "video" ? "play-circle-outline" : "expand-outline"} className="text-xl text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-[12px] font-black uppercase text-white">{getTitle(selectedAd)}</p>
                                            <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.08em] text-white/38">{selectedAd.campaignType}</p>
                                            <p className="mt-1 truncate text-[9px] font-semibold text-white/48">Created {formatExactDateTime(selectedAd.createdAt)}</p>
                                            <Link
                                                href={`/admin/users/${selectedAd.ownerId}?returnTo=${pathname}&from=Ads`}
                                                className="mt-1 block truncate text-[9px] font-semibold text-white/62 hover:text-white"
                                            >
                                                {selectedAd.ownerName || selectedAd.ownerKey || "Unknown User"}
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3">
                                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">Details</p>
                                    <div className="mt-2 space-y-1.5 text-[10px] font-bold text-white">
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Created Time</span><span className="text-right">{formatExactDateTime(selectedAd.createdAt)}</span></div>
                                        {(selectedAd.approvedAt || selectedAd.updatedAt) && selectedAd.status !== "Under Review" && (
                                            <div className="flex items-center justify-between gap-3"><span className="text-white/45">Approved Time</span><span className="text-right">{formatExactDateTime(selectedAd.approvedAt || selectedAd.updatedAt)}</span></div>
                                        )}
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Ad Start Time</span><span className="text-right">{getStartTimeLabel(selectedAd)}</span></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Ad End Time</span><span className="text-right">{getEndTimeLabel(selectedAd)}</span></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Remaining Time</span><span className="text-right">{formatRemainingTime(selectedAd, nowTick)}</span></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Budget</span><span>{formatCurrency(selectedAd.budget)}</span></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Spend</span>{formatSpend(selectedAd.spend)}</div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Remaining</span><span>{formatCurrency(selectedAd.remainingBudget)}</span></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Duration</span><span>{selectedAd.durationDays || 0} days</span></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Status</span><span>{selectedAd.status}</span></div>
                                    </div>
                                </div>

                                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3">
                                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">Targeting</p>
                                    <div className="mt-2 space-y-1.5 text-[10px] font-bold text-white">
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Gender</span><span>{selectedAd.genderTarget || "All"}</span></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Age</span><span>{getAgeLabel(selectedAd)}</span></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Reach</span><span>{formatReachCount(selectedAd.reach || 0)}</span></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Impressions</span><span>{formatReachCount(selectedAd.impressions || 0)}</span></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-white/45">Clicks</span><span>{formatReachCount(selectedAd.clicks || 0)}</span></div>
                                    </div>
                                </div>
                            </div>

                            {cleanAdText(selectedAd.description) && (
                                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3">
                                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">Description</p>
                                    <p className="mt-2 whitespace-pre-wrap text-[10px] font-semibold leading-5 text-white/72">{selectedAd.description}</p>
                                </div>
                            )}

                            {(() => {
                                const cta = getCtaConfig(selectedAd);
                                if (!cta.label) return null;
                                return (
                                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3">
                                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">CTA Button</p>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            {cta.href ? (
                                                <a
                                                    href={cta.href}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-black transition hover:bg-white/90"
                                                >
                                                    {cta.label}
                                                </a>
                                            ) : (
                                                <span className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-black">
                                                    {cta.label}
                                                </span>
                                            )}
                                            <span className="break-all text-[10px] font-semibold text-white/55">{cta.detail || "No CTA link attached"}</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3">
                                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">Coin Actions</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCollectCoin}
                                        disabled={coinLoading}
                                        className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-[9px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/[0.09] disabled:opacity-50"
                                    >
                                        <IonIcon name="heart-outline" className="mr-2 text-base" />
                                        Like
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCollectCoin}
                                        disabled={coinLoading}
                                        className="inline-flex h-9 items-center justify-center rounded-full bg-blue-600 px-4 text-[9px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-blue-500 disabled:opacity-50"
                                    >
                                        <IonIcon name="cash-outline" className="mr-2 text-base" />
                                        {coinLoading ? "Collecting..." : "Collect Coin"}
                                    </button>
                                </div>
                                {coinMessage && (
                                    <p className="mt-2 text-[10px] font-semibold text-white/55">{coinMessage}</p>
                                )}
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                                {selectedAd.status === "Under Review" ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedAd(null); openConfirm(selectedAd.adId, "Active"); }}
                                            className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-[9px] font-black uppercase tracking-[0.08em] text-emerald-300 transition hover:bg-emerald-500/20"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedAd(null); openRejectDialog(selectedAd.adId); }}
                                            className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-[9px] font-black uppercase tracking-[0.08em] text-rose-300 transition hover:bg-rose-500/20"
                                        >
                                            Reject
                                        </button>
                                    </>
                                ) : selectedAd.status === "Active" || selectedAd.status === "Paused" ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedAd(null); openConfirm(selectedAd.adId, selectedAd.status === "Paused" ? "Active" : "Paused"); }}
                                            className={`inline-flex h-11 items-center justify-center rounded-xl border text-[9px] font-black uppercase tracking-[0.08em] transition ${
                                                selectedAd.status === "Paused"
                                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                                    : "border-sky-500/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                                            }`}
                                        >
                                            {selectedAd.status === "Paused" ? "Unpause" : "Pause"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedAd(null); openRejectDialog(selectedAd.adId); }}
                                            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-[9px] font-black uppercase tracking-[0.08em] text-white/70 transition hover:bg-white/[0.09] hover:text-white"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <div className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[9px] font-black uppercase tracking-[0.08em] text-white/45 sm:col-span-2">
                                        {selectedAd.status}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {rejectDialog.open && (
                <div className="fixed inset-0 z-[135] flex items-center justify-center p-3 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                        onClick={() => !isProcessing && setRejectDialog((prev) => ({ ...prev, open: false }))}
                    />
                    <div className="relative z-[136] w-full max-w-[420px] rounded-[1.5rem] border border-white/10 bg-[#121212] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                        <h3 className="text-[1rem] font-black uppercase tracking-[0.06em] text-white">
                            {ads.find(a => a.adId === rejectDialog.adId)?.status === "Under Review" ? "Reject Ad" : "Cancel Ad"}
                        </h3>
                        <p className="mt-2 text-[10px] font-bold leading-5 text-white/50">
                            Select a rejection reason or enter a custom note. Rejecting this ad moves it to cancelled and refunds the held budget back to the user wallet history.
                        </p>

                        <div className="mt-4 space-y-2">
                            {REJECTION_REASONS.map((reason) => (
                                <label
                                    key={reason}
                                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                                        rejectDialog.reason === reason
                                            ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                                            : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="ad-rejection-reason"
                                        checked={rejectDialog.reason === reason}
                                        onChange={() => setRejectDialog((prev) => ({ ...prev, reason }))}
                                        className="h-4 w-4 accent-rose-500"
                                    />
                                    <span>{reason}</span>
                                </label>
                            ))}
                        </div>

                        <div className="mt-4">
                            <p className="mb-2 text-[8px] font-black uppercase tracking-[0.12em] text-white/35">Custom Reason</p>
                            <textarea
                                value={rejectDialog.note}
                                onChange={(event) => setRejectDialog((prev) => ({ ...prev, note: event.target.value }))}
                                rows={3}
                                placeholder="Enter a custom rejection reason if needed"
                                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[10px] font-semibold text-white outline-none placeholder:text-white/25"
                            />
                        </div>

                        <div className="mt-5 grid gap-2 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setRejectDialog((prev) => ({ ...prev, open: false }))}
                                disabled={isProcessing}
                                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-[9px] font-black uppercase tracking-[0.08em] text-white/70 transition hover:bg-white/[0.09] hover:text-white"
                            >
                                Keep Ad
                            </button>
                            <button
                                type="button"
                                onClick={handleRejectedAction}
                                disabled={isProcessing}
                                className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 text-[9px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-rose-500 disabled:opacity-60"
                            >
                                {isProcessing ? "Processing..." : "Reject & Refund"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mediaModal && (
                <div
                    className="fixed inset-0 z-[160] flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
                    onClick={() => setMediaModal(null)}
                >
                    <button
                        type="button"
                        onClick={() => setMediaModal(null)}
                        className="absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all z-10"
                    >
                        <IonIcon name="close-outline" className="text-xl" />
                    </button>
                    <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
                        <p className="mb-3 text-center text-[10px] font-black uppercase tracking-widest text-white/35">{mediaModal.title}</p>
                        {mediaModal.type === "video" ? (
                            // eslint-disable-next-line jsx-a11y/media-has-caption
                            <video
                                src={mediaModal.src}
                                controls
                                autoPlay
                                className="w-full max-h-[80vh] rounded-[1.5rem] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
                            />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={mediaModal.src}
                                alt={mediaModal.title}
                                className="mx-auto max-h-[80vh] max-w-full rounded-[1.5rem] object-contain shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
                            />
                        )}
                    </div>
                </div>
            )}

            {confirmDialog.open && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                        onClick={() => !isProcessing && setConfirmDialog((prev) => ({ ...prev, open: false }))}
                    />
                    <div className="relative z-[131] w-full max-w-[360px] rounded-[1.5rem] border border-white/10 bg-[#121212] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                        <h3 className="text-[1rem] font-black uppercase tracking-[0.06em] text-white">{confirmDialog.title}</h3>
                        <p className="mt-2 text-[10px] font-bold leading-5 text-white/50">{confirmDialog.message}</p>

                        <div className="mt-5 grid gap-2 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                                disabled={isProcessing}
                                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-[9px] font-black uppercase tracking-[0.08em] text-white/70 transition hover:bg-white/[0.09] hover:text-white"
                            >
                                Keep Ad
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmedAction}
                                disabled={isProcessing}
                                className={`inline-flex h-10 items-center justify-center rounded-xl text-[9px] font-black uppercase tracking-[0.08em] transition ${confirmDialog.confirmClass}`}
                            >
                                {isProcessing ? "Processing..." : confirmDialog.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
