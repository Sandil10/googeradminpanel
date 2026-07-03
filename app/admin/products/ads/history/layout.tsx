"use client";

import AdsHistoryNav from "@/components/AdsHistoryNav";

export default function AdsHistoryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-6">
            <AdsHistoryNav />
            {children}
        </div>
    );
}
