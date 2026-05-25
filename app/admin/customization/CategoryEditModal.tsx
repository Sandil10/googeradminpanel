"use client";

import IonIcon from "@/components/IonIcon";

type CategoryOption = {
    id: number;
    name: string;
};

type EditCategoryState = {
    id: number;
    commissionPercent: string;
    level: number;
} | null;

interface CategoryEditModalProps {
    editCategory: EditCategoryState;
    setEditCategory: (value: EditCategoryState) => void;
    saving: boolean;
    onSave: () => void;
}

export default function CategoryEditModal({
    editCategory,
    setEditCategory,
    saving,
    onSave,
}: CategoryEditModalProps) {
    if (!editCategory) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setEditCategory(null)}
            />
            <div className="relative z-[121] w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[#111] p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-black uppercase text-white">Edit Category</h3>
                    <button
                        type="button"
                        onClick={() => setEditCategory(null)}
                        className="rounded-full bg-white/[0.05] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/60"
                    >
                        <IonIcon name="close-outline" className="text-sm" />
                    </button>
                </div>

                <div className="space-y-4">
                    <label className="space-y-2">
                        <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Commission %</span>
                        <input
                            type="number"
                            step="0.01"
                            value={editCategory.commissionPercent}
                            onChange={(event) => setEditCategory({ ...editCategory, commissionPercent: event.target.value })}
                            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                        />
                    </label>
                </div>

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={() => setEditCategory(null)}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/70"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="flex-1 rounded-2xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}
