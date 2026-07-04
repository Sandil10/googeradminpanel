"use client";

import UsersSectionNav from "@/components/UsersSectionNav";

export default function UsersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-6">
            <UsersSectionNav />
            {children}
        </div>
    );
}
