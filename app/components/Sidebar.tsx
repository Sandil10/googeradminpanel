"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { authService } from "../services/authService";
import IonIcon from "./IonIcon";

const menuItems = [
    { name: "Dashboard", icon: "grid", href: "/admin" },
    {
        name: "Users",
        icon: "people",
        children: [
            { name: "All Users", href: "/admin/users/all" },
            { name: "Sellers", href: "/admin/users/sellers" },
            { name: "Employees", href: "/admin/users/employees" },
            { name: "Deactivated Users", href: "/admin/users/deactivated" },
        ]
    },
    {
        name: "Products",
        icon: "bag-handle",
        children: [
            { name: "All Products", href: "/admin/products/all" },
            { name: "Active Products", href: "/admin/products/active" },
            { name: "Reviewed Products", href: "/admin/products/reviewed" },
            { name: "Rejected Products", href: "/admin/products/rejected" },
            { name: "Deactivated Products", href: "/admin/products/deactivated" },
        ]
    },
    { name: "Posts", icon: "document-text", href: "/admin/posts" },
    { name: "Percentage Customization", icon: "options", href: "/admin/customization" },
    { name: "Verification", icon: "checkmark-circle", href: "/admin/verification" },
    { name: "Subscription", icon: "card", href: "/admin/subscription" },
    { name: "Top-up / Requests", icon: "cash", href: "/admin/wallet/topup" },
    { name: "Wallet", icon: "wallet", href: "/admin/wallet/main" },
];

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
    isMobileOpen?: boolean;
    onCloseMobile?: () => void;
}

export default function Sidebar({ isCollapsed, onToggle, isMobileOpen, onCloseMobile }: SidebarProps) {
    const pathname = usePathname();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [openMenus, setOpenMenus] = useState<string[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const toggleMenu = (name: string) => {
        setOpenMenus((prev: string[]) =>
            prev.includes(name) ? prev.filter((m: string) => m !== name) : [...prev, name]
        );
    };

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const profile = await authService.getProfile();
                setUser(profile);
            } catch (error: any) {
                if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('401')) {
                    console.warn("Session invalid - clearing storage");
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }

                if (error.message === 'No session found') {
                    console.warn("User session not found - using guest mode");
                } else {
                    console.error("Error fetching user:", error);
                }
                // Fallback for dev if needed
                setUser({ username: 'admin', full_name: 'Administrator' });
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, []);

    const handleLogout = () => {
        // authService.logout();
        console.log("Logged out");
    };

    // Generate profile image URL
    const cleanUrl = (url: any) => {
        if (!url || typeof url !== 'string') return '';
        let cleaned = url.replace(/\s/g, '').replace(/[\\"]/g, '');
        if (cleaned.startsWith('data:') && cleaned.includes('base64') && !cleaned.includes('base64,')) {
            cleaned = cleaned.replace('base64', 'base64,');
        }
        return cleaned;
    };

    const profileImage = (user?.profile_picture)
        ? (user.profile_picture.startsWith('http') || user.profile_picture.startsWith('data:') ? cleanUrl(user.profile_picture) : `/uploads/${user.profile_picture.split(/[\\/]/).pop()}`)
        : (user ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.username || 'User')}&size=200&background=random` : "");

    return (
        <aside
            className={`fixed left-0 top-0 h-screen bg-black text-white flex flex-col border-r border-[#1a1a1a] z-50 transition-all duration-300 md:translate-x-0 
                ${isMobileOpen ? "translate-x-0 w-64 shadow-[20px_0_60px_rgba(0,0,0,0.8)]" : "-translate-x-full w-64"} 
                ${isCollapsed ? "md:w-20" : "md:w-64"}
            `}
        >
            {/* Brand */}
            <div className="p-6 relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-8 h-8 shrink-0">
                        <Image
                            src="/assets/images/googer.png"
                            alt="Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                    {(!isCollapsed || isMobileOpen) && (
                        <div className="flex flex-col truncate">
                            <h1 className="text-lg font-bold tracking-tight text-white leading-none">Googer</h1>
                            <span className="text-[10px] text-white font-bold uppercase tracking-widest mt-1">Admin Panel</span>
                        </div>
                    )}
                </div>

                {/* Mobile Close Button */}
                <button
                    onClick={onCloseMobile}
                    className="md:hidden p-2 text-slate-400 hover:text-white"
                >
                    <IonIcon name="close-outline" className="text-2xl" />
                </button>

                {/* Collapse Toggle Button (Desktop only) */}
                <button
                    onClick={onToggle}
                    className="hidden md:flex absolute -right-3 top-7 w-6 h-6 bg-[#1a1a1a] text-white rounded-full items-center justify-center border border-[#333] hover:bg-white hover:text-black transition-all z-50"
                >
                    <IonIcon name={isCollapsed ? "chevron-forward-outline" : "chevron-back-outline"} className="text-[10px]" />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1 custom-scrollbar">
                {menuItems.map((item) => {
                    const hasChildren = !!item.children;
                    const isOpen = openMenus.includes(item.name);
                    const isActive = pathname === item.href || item.children?.some(child => pathname === child.href);

                    return (
                        <div key={item.name} className="flex flex-col">
                            {hasChildren ? (
                                <>
                                    <button
                                        onClick={() => toggleMenu(item.name)}
                                        className={`flex items-center gap-4 px-3 py-2.5 rounded-lg transition-all group ${isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                                            } ${(isCollapsed && !isMobileOpen) ? "justify-center" : ""}`}
                                    >
                                        <div className="text-xl w-6 flex justify-center shrink-0">
                                            <IonIcon name={(item.icon || "list") + "-outline"} />
                                        </div>
                                        {(!isCollapsed || isMobileOpen) && (
                                            <>
                                                <span className="font-medium text-sm flex-1 text-left">{item.name}</span>
                                                <IonIcon
                                                    name={isOpen ? "chevron-down" : "chevron-forward"}
                                                    className={`text-[10px] transition-transform ${isOpen ? "rotate-0" : ""}`}
                                                />
                                            </>
                                        )}
                                    </button>
                                    {(!isCollapsed || isMobileOpen) && isOpen && (
                                        <div className="mt-1 ml-10 space-y-1 border-l border-[#1a1a1a] pl-4 animate-in slide-in-from-top-1 duration-200">
                                            {item.children?.map(child => (
                                                <Link
                                                    key={child.name}
                                                    href={child.href}
                                                    onClick={() => setOpenMenus([])}
                                                    className={`block py-2 px-3 text-xs rounded-md transition-colors ${pathname === child.href ? "text-white font-semibold" : "text-gray-500 hover:text-gray-200"}`}
                                                >
                                                    {child.name}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Link
                                    href={item.href || "#"}
                                    onClick={onCloseMobile}
                                    className={`flex items-center gap-4 px-3 py-2.5 rounded-lg transition-all group ${pathname === item.href ? "bg-white text-black shadow-lg shadow-white/10" : "text-slate-400 hover:bg-white/5 hover:text-white"
                                        } ${(isCollapsed && !isMobileOpen) ? "justify-center" : ""}`}
                                    title={isCollapsed ? item.name : ""}
                                >
                                    <div className="text-xl w-6 flex justify-center shrink-0">
                                        <IonIcon name={(item.icon || "list") + "-outline"} />
                                    </div>
                                    {(!isCollapsed || isMobileOpen) && (
                                        <span className="font-medium text-sm transition-opacity duration-200">{item.name}</span>
                                    )}
                                </Link>
                            )}
                        </div>
                    );
                })}
            </nav>


            {/* User Profile Footer */}
            <div className="p-4 border-t border-[#1a1a1a] mt-auto relative">
                {/* User Menu Popup */}
                {showUserMenu && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowUserMenu(false)}
                        ></div>

                        {/* Popup Card */}
                        <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#09090b] rounded-2xl shadow-2xl border border-[#1a1a1a] z-50 overflow-hidden">
                            {/* Gradient Top Bar */}
                            <div className="h-16 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500"></div>

                            {/* User Info */}
                            <div className="p-4 -mt-8">
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-4 border-[#09090b] shrink-0 bg-gray-800">
                                        {user && profileImage && (
                                            <Image
                                                src={profileImage}
                                                alt={user.full_name || user.username || "User"}
                                                fill
                                                className="object-cover"
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 mt-2">
                                        <h3 className="font-bold text-white text-sm truncate">
                                            {user?.full_name || user?.username || "User"}
                                        </h3>
                                        <p className="text-xs text-gray-400 truncate">@{user?.username || "user"}</p>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                                    <div>
                                        <div className="text-white font-bold text-sm">0</div>
                                        <div className="text-gray-500 text-[10px]">Posts</div>
                                    </div>
                                    <div>
                                        <div className="text-white font-bold text-sm">0</div>
                                        <div className="text-gray-500 text-[10px]">Following</div>
                                    </div>
                                    <div>
                                        <div className="text-white font-bold text-sm">0</div>
                                        <div className="text-gray-500 text-[10px]">Followers</div>
                                    </div>
                                </div>

                                {/* Menu Items */}
                                <div className="space-y-1">
                                    <Link
                                        href="/dashboard/profile"
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm text-white"
                                        onClick={() => setShowUserMenu(false)}
                                    >
                                        <span className="text-lg">
                                            <IonIcon name="person-outline" />
                                        </span>
                                        <span>Profile</span>
                                    </Link>
                                    <Link
                                        href="/dashboard/wallet"
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm text-white"
                                        onClick={() => setShowUserMenu(false)}
                                    >
                                        <span className="text-lg">
                                            <IonIcon name="wallet-outline" />
                                        </span>
                                        <span>Wallet</span>
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm text-red-400"
                                    >
                                        <span className="text-lg">
                                            <IonIcon name="log-out-outline" />
                                        </span>
                                        <span>Log Out</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div
                    className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors ${(isCollapsed && !isMobileOpen) ? "justify-center" : ""}`}
                    onClick={() => (!isCollapsed || isMobileOpen) && setShowUserMenu(!showUserMenu)}
                >
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border border-gray-600 shrink-0 bg-gray-800">
                        {user && profileImage && (
                            profileImage.startsWith('data:') ? (
                                <img
                                    src={profileImage}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Image
                                    src={profileImage}
                                    alt={user.full_name || user.username || "User"}
                                    fill
                                    sizes="40px"
                                    className="object-cover"
                                />
                            )
                        )}
                    </div>
                    {(!isCollapsed || isMobileOpen) && (
                        <>
                            <div className="flex-1 min-w-0 transition-opacity duration-200">
                                <p className="text-sm font-semibold truncate">
                                    {user?.full_name || user?.username || "Loading..."}
                                </p>
                                <p className="text-xs text-gray-400 truncate">@{user?.username || "user"}</p>
                            </div>
                            <div className={`text-gray-400 transition-transform duration-200 ${showUserMenu ? "rotate-180" : ""}`}>
                                <IonIcon name="chevron-up-outline" />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
}
