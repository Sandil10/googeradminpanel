"use client";

import { useEffect } from "react";
import IonIcon from "../components/IonIcon";

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Admin Error Boundary]", error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-md">
                <div className="w-20 h-20 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
                    <IonIcon name="warning-outline" className="text-4xl text-rose-400" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">
                        Something went wrong
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        {error?.message || "An unexpected error occurred loading this page."}
                    </p>
                </div>
                <button
                    onClick={reset}
                    className="h-12 px-8 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95 flex items-center gap-2 mx-auto"
                >
                    <IonIcon name="refresh-outline" className="text-sm" />
                    Try Again
                </button>
            </div>
        </div>
    );
}
