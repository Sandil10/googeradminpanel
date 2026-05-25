"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

type HistoryCounts = {
    all: number;
    capitalTransfer: number;
    adCoinCollections: number;
    profilePromote: number;
    adPromoteCollections: number;
    productCommissions: number;
    withdrawalTransactions: number;
};

const historyItems = [
    {
        label: "All History",
        href: "/admin/products/ads/history",
        icon: "albums-outline",
        countKey: "all",
    },
    {
        label: "Capital Transfer",
        href: "/admin/products/ads/history/capital-transfer",
        icon: "arrow-up-circle-outline",
        countKey: "capitalTransfer",
    },
    {
        label: "Ad Coin",
        href: "/admin/products/ads/history/ad-coin-collections",
        icon: "logo-bitcoin",
        countKey: "adCoinCollections",
    },
    {
        label: "Profile Promote",
        href: "/admin/products/ads/history/profile-promote",
        icon: "person-circle-outline",
        countKey: "profilePromote",
    },
    {
        label: "Photo / Product",
        href: "/admin/products/ads/history/ad-promote-collections",
        icon: "images-outline",
        countKey: "adPromoteCollections",
    },
    {
        label: "Product Commission",
        href: "/admin/products/ads/history/product-commissions",
        icon: "pricetags-outline",
        countKey: "productCommissions",
    },
    {
        label: "Withdrawal",
        href: "/admin/products/ads/history/withdrawal-transactions",
        icon: "arrow-up-circle-outline",
        countKey: "withdrawalTransactions",
    },
] as const;

const emptyCounts: HistoryCounts = {
    all: 0,
    capitalTransfer: 0,
    adCoinCollections: 0,
    profilePromote: 0,
    adPromoteCollections: 0,
    productCommissions: 0,
    withdrawalTransactions: 0,
};

export default function AdsHistoryNav() {
    const pathname = usePathname();
    const [counts, setCounts] = useState<HistoryCounts>(emptyCounts);

    useEffect(() => {
        let active = true;

        const loadCounts = async () => {
            try {
                const [
                    capitalTransfer,
                    adCoinCollections,
                    profilePromote,
                    adPromoteCollections,
                    productCommissions,
                    withdrawalTransactions,
                ] = await Promise.all([
                    adminService.fetchCapitalTransferHistory(),
                    adminService.fetchCoinCollectDetail(),
                    adminService.fetchProfilePromoteDetail(),
                    adminService.fetchAdPromoteCollectionDetail(),
                    adminService.fetchProductCommissionHistory(),
                    adminService.fetchWithdrawalTransactions(),
                ]);

                if (!active) return;

                const nextCounts: HistoryCounts = {
                    capitalTransfer: Array.isArray(capitalTransfer) ? capitalTransfer.length : 0,
                    adCoinCollections: Array.isArray(adCoinCollections) ? adCoinCollections.length : 0,
                    profilePromote: Array.isArray(profilePromote) ? profilePromote.length : 0,
                    adPromoteCollections: Array.isArray(adPromoteCollections) ? adPromoteCollections.length : 0,
                    productCommissions: Array.isArray(productCommissions) ? productCommissions.length : 0,
                    withdrawalTransactions: Array.isArray(withdrawalTransactions) ? withdrawalTransactions.length : 0,
                    all: 0,
                };

                nextCounts.all =
                    nextCounts.capitalTransfer +
                    nextCounts.adCoinCollections +
                    nextCounts.profilePromote +
                    nextCounts.adPromoteCollections +
                    nextCounts.productCommissions +
                    nextCounts.withdrawalTransactions;

                setCounts(nextCounts);
            } catch (error) {
                console.error(error);
            }
        };

        loadCounts();
        const interval = setInterval(loadCounts, 5000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    const activeHref = useMemo(() => {
        const matched = historyItems.find((item) => pathname === item.href);
        return matched?.href || "/admin/products/ads/history";
    }, [pathname]);

    return (
        <div className="no-scrollbar overflow-x-auto">
            <div className="inline-flex w-max items-center gap-1.5 rounded-[1.35rem] border border-white/8 bg-[#111111] p-1.5">
                {historyItems.map((item) => {
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
                            <span
                                className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[8px] font-black ${
                                    isActive ? "bg-black/10 text-black" : "bg-white/[0.06] text-white/80"
                                }`}
                            >
                                {count}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
