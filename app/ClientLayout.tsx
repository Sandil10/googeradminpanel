"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import IonIcon from "./components/IonIcon";

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const prefetchAdminRoutes = useCallback(() => {
        [
            "/admin",
            "/admin/users/all",
            "/admin/products/all",
            "/admin/products/ads",
            "/admin/products/ads/history",
            "/admin/wallet/main",
            "/admin/wallet/topup",
            "/admin/wallet/withdrawal",
            "/admin/subscription/purchases",
        ].forEach((href) => {
            router.prefetch(href);
        });
    }, [router]);

    const isLoginPage = pathname === "/";

    useEffect(() => {
        if (isLoginPage) return;
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                router.replace("/");
                return;
            }
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            // Allow if user_type is superadmin OR if user_type is missing (profile not yet fetched)
            if (user && user.user_type && user.user_type !== "superadmin") {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/");
            }
        } catch {
            router.replace("/");
        }
    }, [isLoginPage, pathname]);

    useEffect(() => {
        if (isLoginPage) return;
        const timer = window.setTimeout(prefetchAdminRoutes, 900);
        return () => window.clearTimeout(timer);
    }, [isLoginPage, prefetchAdminRoutes]);

    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <div className="flex min-h-screen bg-black">
            {/* Mobile Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] md:hidden animate-in fade-in duration-300"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar Component */}
            <Sidebar
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                isMobileOpen={isMobileMenuOpen}
                onCloseMobile={() => setIsMobileMenuOpen(false)}
            />

            {/* Main Content Workspace */}
            <div className={`flex min-h-screen min-w-0 flex-1 flex-col transition-all duration-300 ${isSidebarCollapsed ? "md:pl-20" : "md:pl-64"}`}>

                {/* Header / Topbar Area */}
                <header className="sticky top-0 z-40 flex min-h-16 w-full items-center justify-between gap-3 border-b border-[#1a1a1a] bg-black/80 px-3 backdrop-blur-md sm:px-4 md:px-8">
                    <div className="flex min-w-0 items-center gap-2 md:gap-4">
                        {/* Mobile Toggle */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            onTouchStart={prefetchAdminRoutes}
                            className="shrink-0 p-2 text-slate-400 hover:text-white md:hidden"
                        >
                            <IonIcon name="menu-outline" className="text-2xl" />
                        </button>

                        <h2 className="truncate text-sm font-semibold capitalize text-white sm:max-w-[230px] sm:text-base md:max-w-none md:text-lg">
                            {pathname?.split('/').pop()?.replace(/-/g, ' ') || 'Dashboard'}
                        </h2>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-[11px] font-bold text-white leading-none">Admin</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1">Super Admin</p>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
                                AD
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content Scrolling Area */}
                <main className="custom-scrollbar flex-1 overflow-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8">
                    <div className="mx-auto w-full max-w-7xl animate-in fade-in duration-500">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
