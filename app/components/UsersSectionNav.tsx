"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

type UserCounts = {
    all: number;
    sellers: number;
    employees: number;
    deactivated: number;
    deleted: number;
};

const userItems = [
    { label: "All Users", href: "/admin/users/all", icon: "people-outline", countKey: "all" },
    { label: "Sellers", href: "/admin/users/sellers", icon: "storefront-outline", countKey: "sellers" },
    { label: "Employees", href: "/admin/users/employees", icon: "person-badge-outline", countKey: "employees" },
    { label: "Deactivated", href: "/admin/users/deactivated", icon: "person-remove-outline", countKey: "deactivated" },
    { label: "Deleted", href: "/admin/users/deleted", icon: "trash-outline", countKey: "deleted" },
] as const;

const emptyCounts: UserCounts = {
    all: 0,
    sellers: 0,
    employees: 0,
    deactivated: 0,
    deleted: 0,
};

export default function UsersSectionNav() {
    const pathname = usePathname();
    const [counts, setCounts] = useState<UserCounts>(emptyCounts);

    useEffect(() => {
        let active = true;

        const loadCounts = async () => {
            try {
                const [users, deactivated, deleted] = await Promise.all([
                    adminService.fetchAllUsers(),
                    adminService.fetchDeactivatedUsers(),
                    adminService.fetchDeletedUsers(),
                ]);

                if (!active) return;

                const safeUsers = Array.isArray(users) ? users : [];
                const filtered = safeUsers.filter((u) => u?.username?.toLowerCase() !== "admin");

                setCounts({
                    all: filtered.length,
                    sellers: filtered.filter((u) => String(u.user_type || "").toLowerCase() === "seller").length,
                    employees: filtered.filter((u) => String(u.user_type || "").toLowerCase() === "employee").length,
                    deactivated: Array.isArray(deactivated) ? deactivated.length : 0,
                    deleted: Array.isArray(deleted) ? deleted.length : 0,
                });
            } catch (error) {
                console.error(error);
            }
        };

        loadCounts();
        const interval = setInterval(loadCounts, 30000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    const activeHref = useMemo(() => {
        const matched = userItems.find((item) => pathname === item.href);
        return matched?.href || "/admin/users/all";
    }, [pathname]);

    return (
        <div className="no-scrollbar overflow-x-auto">
            <div className="inline-flex flex-wrap items-center gap-1.5 rounded-[1.35rem] border border-white/8 bg-[#111111] p-1.5">
                {userItems.map((item) => {
                    const isActive = activeHref === item.href;
                    const count = counts[item.countKey];

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            scroll={false}
                            prefetch
                            className={`inline-flex h-9 items-center gap-2 rounded-[0.95rem] px-3 text-[8px] font-black uppercase tracking-[0.06em] whitespace-nowrap transition-all ${
                                isActive
                                    ? "bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.08)]"
                                    : "text-[#6e84ad] hover:bg-white/[0.05] hover:text-white"
                            }`}
                        >
                            <IonIcon name={item.icon} className={`${isActive ? "text-black" : "text-[#7f92b6]"} text-[13px]`} />
                            <span>{item.label}</span>
                            <span className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[8px] font-black ${isActive ? "bg-black/10 text-black" : "bg-white/[0.06] text-white/80"}`}>
                                {count}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
