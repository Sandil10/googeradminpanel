"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import Sidebar from "./components/Sidebar";
import IonIcon from "./components/IonIcon";

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    return (
        <div className="flex h-screen overflow-hidden">
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
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 w-full ${isSidebarCollapsed ? "md:pl-20" : "md:pl-64"}`}>
                
                {/* Header / Topbar Area */}
                <header className="h-16 border-b border-[#1a1a1a] bg-black/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 w-full">
                    <div className="flex items-center gap-2 md:gap-4">
                        {/* Mobile Toggle */}
                        <button 
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 text-slate-400 hover:text-white md:hidden"
                        >
                            <IonIcon name="menu-outline" className="text-2xl" />
                        </button>
                        
                        <h2 className="text-base md:text-lg font-semibold text-white capitalize truncate max-w-[150px] md:max-w-none">
                            {pathname?.split('/').pop()?.replace(/-/g, ' ') || 'Dashboard'}
                        </h2>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-slate-400 hover:text-white transition-colors">
                            <IonIcon name="notifications-outline" className="text-xl" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-white transition-colors">
                            <IonIcon name="settings-outline" className="text-xl" />
                        </button>
                        <div className="h-8 w-px bg-slate-800 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-white leading-none">Admin</p>
                                <p className="text-[10px] text-slate-500 mt-1">Super Admin</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                                AD
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content Scrolling Area */}
                <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
