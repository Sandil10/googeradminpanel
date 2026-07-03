"use client";

import { useState } from "react";
import IonIcon from "@/components/IonIcon";

export type CategoryNode = {
    id: number;
    name: string;
    level: number;
    parent_id: number | null;
    commission_percent?: number | string;
    children?: CategoryNode[];
};

type CategoryTableProps = {
    label: string;
    nodes: CategoryNode[];
    onSaveCommission?: (id: number, value: number) => Promise<void>;
    onAddChild?: (parent: CategoryNode) => void;
};

const formatCommission = (value: string | number | null | undefined) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return "No commission";
    return `${numeric.toFixed(2)}%`;
};

export default function CategoryTable({ label, nodes, onSaveCommission, onAddChild }: CategoryTableProps) {
    const [expandedIds, setExpandedIds] = useState<number[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [savingId, setSavingId] = useState<number | null>(null);
    const [errorId, setErrorId] = useState<number | null>(null);
    const [saveError, setSaveError] = useState<string>("");

    const toggleNode = (id: number) => {
        setExpandedIds((prev) =>
            prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
        );
    };

    const startEdit = (node: CategoryNode) => {
        setEditingId(node.id);
        setEditValue(String(Number(node.commission_percent || 0)));
        setErrorId(null);
        setSaveError("");
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValue("");
        setErrorId(null);
        setSaveError("");
    };

    const saveEdit = async (node: CategoryNode) => {
        if (!onSaveCommission) return;
        const numeric = Number.parseFloat(editValue);
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
            setErrorId(node.id);
            setSaveError("Enter a value between 0 and 100");
            return;
        }
        try {
            setSavingId(node.id);
            setErrorId(null);
            setSaveError("");
            await onSaveCommission(node.id, numeric);
            setEditingId(null);
            setEditValue("");
        } catch (err: any) {
            setErrorId(node.id);
            setSaveError(err?.message || "Failed to save. Please try again.");
        } finally {
            setSavingId(null);
        }
    };

    const renderNode = (node: CategoryNode, depth = 0, parentName = "Root") => {
        const hasChildren = Boolean(node.children?.length);
        const isExpanded = expandedIds.includes(node.id);
        const isLevel1 = node.level === 1;
        const isEditing = editingId === node.id;
        const isSaving = savingId === node.id;
        const hasError = errorId === node.id;
        const canAddChild = node.level < 3;

        const levelColors: Record<number, string> = {
            1: "border-blue-400/20 bg-blue-400/5",
            2: "border-purple-400/20 bg-purple-400/5",
            3: "border-green-400/20 bg-green-400/5",
        };

        return (
            <div key={node.id} className={depth > 0 ? "ml-4 pl-4 border-l border-white/10" : ""}>
                <div className="relative">
                    {depth > 0 && <div className="absolute -left-[18px] top-5 h-px w-3.5 bg-white/10" />}
                    <div className={`rounded-2xl border p-3.5 ${levelColors[node.level] || "border-white/10 bg-black/20"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Name + level badge */}
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                <p className="truncate text-xs font-black uppercase text-white">{node.name}</p>
                                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-white/40">
                                    L{node.level}
                                </span>
                            </div>

                            {/* Action buttons */}
                            <div className="flex shrink-0 items-center gap-1.5">
                                {/* Expand/collapse */}
                                {hasChildren && (
                                    <button
                                        type="button"
                                        onClick={() => toggleNode(node.id)}
                                        className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/60 transition hover:bg-white/[0.08]"
                                    >
                                        <IonIcon name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"} className="text-xs" />
                                        <span className="ml-1">{node.children!.length}</span>
                                    </button>
                                )}

                                {/* Add child */}
                                {canAddChild && onAddChild && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onAddChild(node);
                                            if (!isExpanded) toggleNode(node.id);
                                        }}
                                        className="rounded-xl border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/70 transition hover:bg-white/[0.12] hover:text-white"
                                    >
                                        <IonIcon name="add-outline" className="text-xs" />
                                        <span className="ml-1">Add</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Commission row */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-white/45">
                                {parentName}
                            </span>

                            {isLevel1 && isEditing ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className={`w-20 rounded-xl border px-3 py-1 text-[11px] font-bold text-white outline-none bg-black/40 ${hasError ? "border-red-400/60" : "border-white/20"}`}
                                        placeholder="0.00"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") saveEdit(node);
                                            if (e.key === "Escape") cancelEdit();
                                        }}
                                    />
                                    <span className="text-[10px] font-bold text-white/45">%</span>
                                    <button
                                        type="button"
                                        onClick={() => saveEdit(node)}
                                        disabled={isSaving}
                                        className="rounded-xl bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-black transition hover:bg-white/90 disabled:opacity-50"
                                    >
                                        {isSaving ? "..." : "Save"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/60 transition hover:bg-white/[0.1]"
                                    >
                                        Cancel
                                    </button>
                                    {hasError && (
                                        <span className="text-[9px] font-bold text-red-400">{saveError || "0–100 only"}</span>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                                        {formatCommission(node.commission_percent)}
                                    </span>
                                    {isLevel1 && onSaveCommission && (
                                        <button
                                            type="button"
                                            onClick={() => startEdit(node)}
                                            className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-white/50 transition hover:bg-white/[0.09] hover:text-white"
                                        >
                                            <IonIcon name="pencil-outline" className="mr-1 text-[9px]" />
                                            Edit %
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div className="mt-2 space-y-2">
                        {node.children!.map((child) => renderNode(child, depth + 1, node.name))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">{label}</p>
                    <h3 className="text-sm font-black uppercase text-white">{nodes.length} main categories</h3>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/30">
                    <span className="h-2 w-2 rounded-full bg-blue-400/60" /> L1
                    <span className="h-2 w-2 rounded-full bg-purple-400/60" /> L2
                    <span className="h-2 w-2 rounded-full bg-green-400/60" /> L3
                </div>
            </div>

            <div className="space-y-2">
                {nodes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-[10px] font-bold uppercase tracking-widest text-white/25">
                        No categories yet — click "Add Category" to create one
                    </div>
                ) : (
                    nodes.map((node) => renderNode(node))
                )}
            </div>
        </div>
    );
}
