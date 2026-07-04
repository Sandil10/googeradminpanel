"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

type ProductCounts = {
    all: number;
    active: number;
    reviewed: number;
    rejected: number;
    deactivated: number;
};

const productItems = [
    { label: "All Products", href: "/admin/products/all", icon: "bag-handle-outline", countKey: "all" },
    { label: "Active", href: "/admin/products/active", icon: "checkmark-circle-outline", countKey: "active" },
    { label: "Reviewed", href: "/admin/products/reviewed", icon: "time-outline", countKey: "reviewed" },
    { label: "Rejected", href: "/admin/products/rejected", icon: "close-circle-outline", countKey: "rejected" },
    { label: "Deactivated", href: "/admin/products/deactivated", icon: "pause-circle-outline", countKey: "deactivated" },
] as const;

const emptyCounts: ProductCounts = {
    all: 0,
    active: 0,
    reviewed: 0,
    rejected: 0,
    deactivated: 0,
};

export default function ProductsSectionNav() {
    const pathname = usePathname();
    const [counts, setCounts] = useState<ProductCounts>(emptyCounts);

    useEffect(() => {
        let active = true;

        const loadCounts = async () => {
            try {
                const [all, activeProducts, reviewed, rejected, deactivated] = await Promise.all([
                    adminService.fetchAllProducts(),
                    adminService.fetchAllProducts("active"),
                    adminService.fetchAllProducts("reviewing"),
                    adminService.fetchAllProducts("rejected"),
                    adminService.fetchAllProducts("inactive"),
                ]);

                if (!active) return;

                setCounts({
                    all: Array.isArray(all) ? all.length : 0,
                    active: Array.isArray(activeProducts) ? activeProducts.length : 0,
                    reviewed: Array.isArray(reviewed) ? reviewed.length : 0,
                    rejected: Array.isArray(rejected) ? rejected.length : 0,
                    deactivated: Array.isArray(deactivated) ? deactivated.length : 0,
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
        const matched = productItems.find((item) => pathname === item.href);
        return matched?.href || "/admin/products/all";
    }, [pathname]);

    return (
        <div className="no-scrollbar overflow-x-auto">
            <div className="inline-flex flex-wrap items-center gap-1.5 rounded-[1.35rem] border border-white/8 bg-[#111111] p-1.5">
                {productItems.map((item) => {
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
