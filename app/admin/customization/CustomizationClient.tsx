"use client";

import { useEffect, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import { commissionService } from "@/services/commissionService";
import { categoryService } from "@/services/categoryService";
import AdCoinRewardSettingsCard from "./AdCoinRewardSettingsCard";
import AdAllowedCountriesCard from "./AdAllowedCountriesCard";
import CategoryFormModal from "./CategoryFormModal";
import CategoryTable, { CategoryNode } from "./CategoryTable";
import PromoCodeCard from "./PromoCodeCard";
import ReachSettingsCard from "./ReachSettingsCard";

type CategoryTreeNode = CategoryNode & { children?: CategoryTreeNode[] };

type CommissionSettings = {
    googleCommission: number;
    referralMultiplier: number;
    adClickCommission: number;
    preAdCommission: number;
    generalCategoryCommission: number;
    manualCategoryCommissionEnabled: boolean;
};

type CategoryFormState = {
    level: 1 | 2 | 3;
    name: string;
    parentId: string;
    commissionPercent: string;
};

const EMPTY_FORM: CategoryFormState = {
    level: 2,
    name: "",
    parentId: "",
    commissionPercent: "0",
};

const EMPTY_COMMISSIONS: CommissionSettings = {
    googleCommission: 0,
    referralMultiplier: 0,
    adClickCommission: 0,
    preAdCommission: 0,
    generalCategoryCommission: 0,
    manualCategoryCommissionEnabled: false,
};

const toNumber = (value: string | number | null | undefined) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const flattenCategories = (nodes: CategoryTreeNode[]): CategoryNode[] => {
    const list: CategoryNode[] = [];
    const walk = (items: CategoryTreeNode[]) => {
        for (const item of items) {
            list.push(item);
            if (item.children?.length) walk(item.children);
        }
    };
    walk(nodes);
    return list;
};

export default function CustomizationClient() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [managedTree, setManagedTree] = useState<CategoryNode[]>([]);
    const [flatCategories, setFlatCategories] = useState<CategoryNode[]>([]);
    const [commissions, setCommissions] = useState<CommissionSettings>(EMPTY_COMMISSIONS);
    const [activeTab, setActiveTab] = useState<"categories" | "commissions" | "promo-codes" | "reach" | "ad-countries">("categories");
    const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_FORM);
    const [showAddModal, setShowAddModal] = useState(false);
    const [treeRenderKey, setTreeRenderKey] = useState(0);

    const loadData = async () => {
        try {
            setLoading(true);
            const payload = await adminService.fetchPublicCustomizationOverview();
            const nextCategories = Array.isArray(payload?.categories) ? payload.categories : [];
            const nextFlat = Array.isArray(payload?.flatCategories) ? payload.flatCategories : flattenCategories(nextCategories);

            setManagedTree(nextCategories);
            setFlatCategories(nextFlat);
            setCommissions(payload?.commissions || EMPTY_COMMISSIONS);
            setTreeRenderKey((value) => value + 1);
            setMessage(null);
        } catch (error: any) {
            setMessage(error.message || "Failed to load customization data");
        } finally {
            setLoading(false);
        }
    };

    const syncCommissionSettings = (nextCommissions: Partial<CommissionSettings>) => {
        setCommissions((prev) => ({ ...prev, ...nextCommissions }));
        commissionService.notifyCommissionSettingsChanged();
    };

    const saveCommissionSettings = async (
        nextCommissions: Partial<CommissionSettings>,
        successMessage?: string | null
    ) => {
        const response = await adminService.updateAdCommission({
            referralMultiplier: nextCommissions.referralMultiplier ?? commissions.referralMultiplier,
            adClickCommission: nextCommissions.adClickCommission ?? commissions.adClickCommission,
            preAdCommission: nextCommissions.preAdCommission ?? commissions.preAdCommission,
            generalCategoryCommission: nextCommissions.generalCategoryCommission ?? commissions.generalCategoryCommission,
            manualCategoryCommissionEnabled: nextCommissions.manualCategoryCommissionEnabled ?? commissions.manualCategoryCommissionEnabled,
        });

        const nextValues = response?.commissions || nextCommissions;
        syncCommissionSettings(nextValues);
        setMessage(successMessage ?? null);
        return nextValues;
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreateCategory = async () => {
        if (!categoryForm.name.trim()) {
            setMessage("Category name is required");
            return;
        }
        if (categoryForm.level > 1 && !categoryForm.parentId) {
            setMessage("Select a parent category first");
            return;
        }

        try {
            setSaving(true);
            await adminService.createCategory({
                level: categoryForm.level,
                name: categoryForm.name.trim(),
                parentId: categoryForm.parentId ? Number(categoryForm.parentId) : null,
                commissionPercent: toNumber(categoryForm.commissionPercent),
            });
            categoryService.notifyCategoryTreeChanged();
            setCategoryForm(EMPTY_FORM);
            setShowAddModal(false);
            await loadData();
            setMessage("Category saved successfully");
        } catch (error: any) {
            setMessage(error.message || "Failed to save category");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAdCommission = async () => {
        try {
            setSaving(true);
            await saveCommissionSettings({}, "Ad commission settings saved");
        } catch (error: any) {
            setMessage(error.message || "Failed to save ad commission settings");
        } finally {
            setSaving(false);
        }
    };

    const openAddCategoryModal = () => {
        setCategoryForm({
            ...EMPTY_FORM,
            commissionPercent: String(commissions.generalCategoryCommission ?? 0),
        });
        setShowAddModal(true);
    };

    const openAddChildModal = (parent: CategoryNode) => {
        setCategoryForm({
            ...EMPTY_FORM,
            parentId: String(parent.id),
            level: Math.min((parent.level + 1), 3) as 1 | 2 | 3,
            commissionPercent: String(commissions.generalCategoryCommission ?? 0),
        });
        setShowAddModal(true);
    };

    const handleSaveGlobalCategoryCommission = async () => {
        try {
            setSaving(true);
            await saveCommissionSettings({ generalCategoryCommission: commissions.generalCategoryCommission });
        } catch (error: any) {
            setMessage(error.message || "Failed to save category commission");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCategoryCommission = async (id: number, value: number) => {
        await adminService.updateCategoryCommission(id, value);
        // Refresh tree so the updated commission_percent propagates to the product modal
        categoryService.notifyCategoryTreeChanged();
        await loadData();
        setMessage("Category commission saved");
    };

    const handleManualCategoryToggle = async () => {
        const nextEnabled = !commissions.manualCategoryCommissionEnabled;
        setCommissions((prev) => ({ ...prev, manualCategoryCommissionEnabled: nextEnabled }));

        try {
            setSaving(true);
            await saveCommissionSettings(
                { manualCategoryCommissionEnabled: nextEnabled },
                `Manual Googer commission ${nextEnabled ? "enabled" : "disabled"}`
            );
        } catch (error: any) {
            setCommissions((prev) => ({ ...prev, manualCategoryCommissionEnabled: !nextEnabled }));
            setMessage(error.message || "Failed to update manual Googer commission");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Percentage Customization</h1>
                    <p className="text-sm text-white/45">Manage real categories, hierarchy, and commissions from the database.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {message && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/75">
                            {message}
                        </div>
                    )}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={commissions.manualCategoryCommissionEnabled}
                        onClick={handleManualCategoryToggle}
                        disabled={saving}
                        className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                            commissions.manualCategoryCommissionEnabled
                                ? "border-emerald-400/40 bg-emerald-500/10"
                                : "border-white/10 bg-white/[0.04]"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45">
                            Manual Googer Comm
                        </span>
                        <span
                            className={`relative h-6 w-11 rounded-full border transition ${
                                commissions.manualCategoryCommissionEnabled
                                    ? "border-emerald-400/60 bg-emerald-400/20"
                                    : "border-white/10 bg-black/30"
                            }`}
                        >
                            <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                                    commissions.manualCategoryCommissionEnabled ? "left-6" : "left-0.5"
                                }`}
                            />
                        </span>
                        <span
                            className={`text-[9px] font-black uppercase tracking-[0.2em] ${
                                commissions.manualCategoryCommissionEnabled ? "text-emerald-300" : "text-white/35"
                            }`}
                        >
                            {commissions.manualCategoryCommissionEnabled ? "On" : "Off"}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("reach")}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/70 transition hover:bg-white/[0.08]"
                    >
                        Reach
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("ad-countries")}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/70 transition hover:bg-white/[0.08]"
                    >
                        Ad Countries
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("promo-codes")}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/70 transition hover:bg-white/[0.08]"
                    >
                        Add Promo Code
                    </button>
                    <button
                        type="button"
                        onClick={openAddCategoryModal}
                        className="rounded-2xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white/90"
                    >
                        Add Category
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {[
                    { key: "categories", label: "Categories" },
                    { key: "commissions", label: "Commissions" },
                    { key: "promo-codes", label: "Promo Codes" },
                    { key: "reach", label: "Reach" },
                    { key: "ad-countries", label: "Ad Countries" },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key as "categories" | "commissions" | "promo-codes" | "reach" | "ad-countries")}
                        className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                            activeTab === tab.key ? "bg-white text-black" : "bg-white/[0.04] text-white/55 hover:bg-white/[0.08]"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-8 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                    Loading customization data...
                </div>
            ) : (
                <>
                    {activeTab === "categories" && (
                        <div className="space-y-6">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Managed Categories</p>
                                        <h3 className="text-sm font-black uppercase text-white">Safe editable category store</h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={openAddCategoryModal}
                                        className="rounded-2xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white/90"
                                    >
                                        Add Category
                                    </button>
                                </div>
                                <p className="mt-2 text-xs text-white/45">Add, edit, or delete categories from the protected DB-backed store without touching product rows.</p>
                            </div>

                            <CategoryTable
                                key={treeRenderKey}
                                label="Managed Category Tree"
                                nodes={managedTree}
                                onSaveCommission={handleSaveCategoryCommission}
                                onAddChild={openAddChildModal}
                            />
                        </div>
                    )}

                    {activeTab === "reach" && (
                        <div className="space-y-4">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Reach Formula</p>
                                <h3 className="text-sm font-black uppercase text-white">Estimated Reach Settings</h3>
                                <p className="mt-1 text-xs text-white/45">
                                    Reach Min = (budget ÷ 100) × Min Multiplier &nbsp;·&nbsp; Reach Max = (budget ÷ 100) × Max Multiplier
                                </p>
                            </div>
                            <ReachSettingsCard />
                        </div>
                    )}

                    {activeTab === "ad-countries" && (
                        <div className="space-y-4">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Location Targeting</p>
                                <h3 className="text-sm font-black uppercase text-white">Ad Allowed Countries</h3>
                                <p className="mt-1 text-xs text-white/45">Select which countries appear in the location dropdown for each ad type. Leave empty to allow all countries.</p>
                            </div>
                            <AdAllowedCountriesCard />
                        </div>
                    )}

                    {activeTab === "promo-codes" && (
                        <div className="space-y-4">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Promo Code Management</p>
                                <h3 className="text-sm font-black uppercase text-white">Create & manage promo codes per ad type</h3>
                                <p className="mt-1 text-xs text-white/45">Photo/video and product ads use rupee discounts. Profile promote ads use free days.</p>
                            </div>
                            <PromoCodeCard />
                        </div>
                    )}

                    {activeTab === "commissions" && (
                        <div className="grid gap-6 xl:grid-cols-1">
                            <div className="space-y-6">
                                <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 space-y-4">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Referral Commission</p>
                                        <h3 className="text-sm font-black uppercase text-white">Referral & Platform Settings</h3>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <label className="space-y-2">
                                            <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Referral Multiplier</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={commissions.referralMultiplier}
                                                onChange={(event) => setCommissions((prev) => ({ ...prev, referralMultiplier: Number(event.target.value) }))}
                                                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                                            />
                                        </label>
                                        <label className="space-y-2">
                                            <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">General Category Commission</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={commissions.generalCategoryCommission}
                                                onChange={(event) => setCommissions((prev) => ({ ...prev, generalCategoryCommission: Number(event.target.value) }))}
                                                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                                            />
                                        </label>
                                    </div>

                                    <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Ad Commission</p>
                                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                                            <label className="space-y-2">
                                                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Ad Click Commission</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={commissions.adClickCommission}
                                                    onChange={(event) => setCommissions((prev) => ({ ...prev, adClickCommission: Number(event.target.value) }))}
                                                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                                                />
                                            </label>
                                            <label className="space-y-2">
                                                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Pre-ad Commission</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={commissions.preAdCommission}
                                                    onChange={(event) => setCommissions((prev) => ({ ...prev, preAdCommission: Number(event.target.value) }))}
                                                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSaveAdCommission}
                                        className="rounded-2xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white/90"
                                    >
                                        Save Commission Settings
                                    </button>
                                </div>

                                <AdCoinRewardSettingsCard />
                            </div>
                        </div>
                    )}
                </>
            )}

            <CategoryFormModal
                open={showAddModal}
                saving={saving}
                form={categoryForm}
                tree={managedTree}
                commissionLocked={!commissions.manualCategoryCommissionEnabled}
                onClose={() => {
                    setShowAddModal(false);
                    setCategoryForm(EMPTY_FORM);
                }}
                onChange={setCategoryForm}
                onSave={handleCreateCategory}
            />
        </div>
    );
}
