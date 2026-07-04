"use client";

import { useState } from "react";
import IonIcon from "@/components/IonIcon";
import { CategoryNode } from "./CategoryTable";

type CategoryFormState = {
    level: 1 | 2 | 3;
    name: string;
    parentId: string;
    commissionPercent: string;
};

interface CategoryFormModalProps {
    open: boolean;
    saving: boolean;
    form: CategoryFormState;
    tree: CategoryNode[];
    commissionLocked?: boolean;
    onClose: () => void;
    onChange: (next: CategoryFormState) => void;
    onSave: () => void;
}

function TreePicker({
    nodes,
    selectedId,
    onSelect,
}: {
    nodes: CategoryNode[];
    selectedId: string;
    onSelect: (node: CategoryNode | null) => void;
}) {
    const [expandedIds, setExpandedIds] = useState<number[]>(() =>
        nodes.map((n) => n.id)
    );

    const toggle = (id: number) =>
        setExpandedIds((prev) =>
            prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
        );

    const renderNode = (node: CategoryNode, depth = 0) => {
        const hasChildren = Boolean(node.children?.length);
        const isExpanded = expandedIds.includes(node.id);
        const isSelected = selectedId === String(node.id);
        const canSelect = node.level < 3;

        return (
            <div key={node.id}>
                <div
                    className={`flex items-center gap-1.5 rounded-xl py-1.5 pr-2 transition ${
                        isSelected
                            ? "border border-white/20 bg-white/10"
                            : "border border-transparent hover:bg-white/[0.04]"
                    }`}
                    style={{ paddingLeft: `${8 + depth * 14}px` }}
                >
                    {/* expand toggle */}
                    <button
                        type="button"
                        onClick={() => hasChildren && toggle(node.id)}
                        className={`shrink-0 text-white/30 transition ${hasChildren ? "hover:text-white/60" : "opacity-0 pointer-events-none"}`}
                    >
                        <IonIcon
                            name={isExpanded ? "chevron-down-outline" : "chevron-forward-outline"}
                            className="text-[10px]"
                        />
                    </button>

                    {/* colour dot */}
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        node.level === 1 ? "bg-blue-400/70" : node.level === 2 ? "bg-purple-400/70" : "bg-green-400/70"
                    }`} />

                    {/* name */}
                    <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-white">
                        {node.name}
                    </span>

                    {/* level badge */}
                    <span className="shrink-0 text-[7px] font-black uppercase tracking-widest text-white/30">
                        L{node.level}
                    </span>

                    {/* select / max-depth */}
                    {canSelect ? (
                        <button
                            type="button"
                            onClick={() => onSelect(isSelected ? null : node)}
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest transition ${
                                isSelected
                                    ? "bg-white text-black"
                                    : "border border-white/10 bg-white/[0.05] text-white/50 hover:bg-white/[0.12] hover:text-white"
                            }`}
                        >
                            {isSelected ? "✓" : "Pick"}
                        </button>
                    ) : (
                        <span className="shrink-0 text-[7px] font-black uppercase tracking-widest text-white/20">
                            —
                        </span>
                    )}
                </div>

                {hasChildren && isExpanded && (
                    <div>
                        {node.children!.map((child) => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-0.5">
            {/* Root option */}
            <button
                type="button"
                onClick={() => onSelect(null)}
                className={`flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5 text-left transition ${
                    selectedId === ""
                        ? "border border-white/20 bg-white/10"
                        : "border border-transparent hover:bg-white/[0.04]"
                }`}
            >
                <span className="w-3.5 shrink-0" />
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-white">Root</span>
                <span className="shrink-0 text-[7px] font-black uppercase tracking-widest text-white/30">L1</span>
                <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest ${
                        selectedId === ""
                            ? "bg-white text-black"
                            : "border border-white/10 bg-white/[0.05] text-white/50"
                    }`}
                >
                    {selectedId === "" ? "✓" : "Pick"}
                </span>
            </button>

            {nodes.map((node) => renderNode(node))}
        </div>
    );
}

export default function CategoryFormModal({
    open,
    saving,
    form,
    tree,
    commissionLocked = false,
    onClose,
    onChange,
    onSave,
}: CategoryFormModalProps) {
    if (!open) return null;

    const levelLabel = form.level === 1 ? "Main Category (Level 1)" : form.level === 2 ? "Sub-Category (Level 2)" : "Sub-Sub-Category (Level 3)";

    const handleSelectParent = (node: CategoryNode | null) => {
        if (!node) {
            onChange({ ...form, parentId: "", level: 1 });
        } else {
            onChange({
                ...form,
                parentId: String(node.id),
                level: (node.level + 1) as 1 | 2 | 3,
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative z-[121] flex w-full max-w-2xl flex-col rounded-[1.75rem] border border-white/10 bg-[#111] shadow-2xl max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                        <h3 className="text-base font-black uppercase text-white">Add Category</h3>
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">
                            {levelLabel}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full bg-white/[0.05] p-2 text-white/60 hover:bg-white/[0.1]"
                    >
                        <IonIcon name="close-outline" className="text-base" />
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden md:flex-row">
                    {/* Left: tree picker */}
                    <div className="flex flex-col border-b border-white/10 md:w-56 md:border-b-0 md:border-r md:shrink-0">
                        <p className="px-4 pt-4 pb-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
                            Add under
                        </p>
                        <div className="flex-1 overflow-y-auto px-2 pb-4">
                            <TreePicker
                                nodes={tree}
                                selectedId={form.parentId}
                                onSelect={handleSelectParent}
                            />
                        </div>
                    </div>

                    {/* Right: form fields */}
                    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
                        {/* Selected location banner */}
                        <div className={`rounded-2xl border px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${
                            form.level === 1
                                ? "border-blue-400/20 bg-blue-400/5 text-blue-300"
                                : form.level === 2
                                ? "border-purple-400/20 bg-purple-400/5 text-purple-300"
                                : "border-green-400/20 bg-green-400/5 text-green-300"
                        }`}>
                            <div className="flex items-center gap-2">
                                <IonIcon name="location-outline" className="text-sm" />
                                <span>
                                    {form.parentId === ""
                                        ? "Adding as Root → Level 1"
                                        : `Adding under selected → Level ${form.level}`}
                                </span>
                            </div>
                        </div>

                        {/* Name */}
                        <label className="space-y-2">
                            <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
                                Category Name
                            </span>
                            <input
                                value={form.name}
                                onChange={(e) => onChange({ ...form, name: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
                                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                                placeholder="e.g. Electronics, Shirts, Books..."
                                autoFocus
                            />
                        </label>

                        {/* Commission — Level 1 only */}
                        {form.level === 1 && (
                            <label className="space-y-2">
                                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
                                    Commission %
                                </span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={form.commissionPercent}
                                    onChange={(e) => onChange({ ...form, commissionPercent: e.target.value })}
                                    readOnly={commissionLocked}
                                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                                    placeholder="0.00"
                                />
                                {commissionLocked && (
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
                                        Locked to global setting — enable Manual Googer Comm to override.
                                    </p>
                                )}
                            </label>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 border-t border-white/10 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/70 transition hover:bg-white/[0.08]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving || !form.name.trim()}
                        className="flex-1 rounded-2xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white/90 disabled:opacity-40"
                    >
                        {saving ? "Saving..." : "Save Category"}
                    </button>
                </div>
            </div>
        </div>
    );
}
