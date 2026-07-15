"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import IonIcon from "../../../components/IonIcon";
import { adminService } from "../../../services/adminService";

interface User {
  id: number;
  user_id: string;
  username: string;
  full_name: string;
  user_type: string;
  email: string;
  wallet_balance: string;
  status: string;
  is_deactivated?: boolean;
  suspended_wallet_access?: boolean;
  created_at: string;
  country?: string;
}

function countryFlag(name: string): string {
  const map: Record<string, string> = {
    "Afghanistan": "🇦🇫", "Albania": "🇦🇱", "Algeria": "🇩🇿", "Andorra": "🇦🇩", "Angola": "🇦🇴",
    "Argentina": "🇦🇷", "Armenia": "🇦🇲", "Australia": "🇦🇺", "Austria": "🇦🇹", "Azerbaijan": "🇦🇿",
    "Bahamas": "🇧🇸", "Bahrain": "🇧🇭", "Bangladesh": "🇧🇩", "Belarus": "🇧🇾", "Belgium": "🇧🇪",
    "Belize": "🇧🇿", "Benin": "🇧🇯", "Bhutan": "🇧🇹", "Bolivia": "🇧🇴", "Bosnia": "🇧🇦",
    "Botswana": "🇧🇼", "Brazil": "🇧🇷", "Brunei": "🇧🇳", "Bulgaria": "🇧🇬", "Burkina Faso": "🇧🇫",
    "Cambodia": "🇰🇭", "Cameroon": "🇨🇲", "Canada": "🇨🇦", "Chad": "🇹🇩", "Chile": "🇨🇱",
    "China": "🇨🇳", "Colombia": "🇨🇴", "Congo": "🇨🇬", "Costa Rica": "🇨🇷", "Croatia": "🇭🇷",
    "Cuba": "🇨🇺", "Cyprus": "🇨🇾", "Czech Republic": "🇨🇿", "Denmark": "🇩🇰", "Djibouti": "🇩🇯",
    "Dominican Republic": "🇩🇴", "Ecuador": "🇪🇨", "Egypt": "🇪🇬", "El Salvador": "🇸🇻",
    "Estonia": "🇪🇪", "Ethiopia": "🇪🇹", "Fiji": "🇫🇯", "Finland": "🇫🇮", "France": "🇫🇷",
    "Gabon": "🇬🇦", "Georgia": "🇬🇪", "Germany": "🇩🇪", "Ghana": "🇬🇭", "Greece": "🇬🇷",
    "Guatemala": "🇬🇹", "Guinea": "🇬🇳", "Haiti": "🇭🇹", "Honduras": "🇭🇳", "Hungary": "🇭🇺",
    "Iceland": "🇮🇸", "India": "🇮🇳", "Indonesia": "🇮🇩", "Iran": "🇮🇷", "Iraq": "🇮🇶",
    "Ireland": "🇮🇪", "Israel": "🇮🇱", "Italy": "🇮🇹", "Jamaica": "🇯🇲", "Japan": "🇯🇵",
    "Jordan": "🇯🇴", "Kazakhstan": "🇰🇿", "Kenya": "🇰🇪", "Kuwait": "🇰🇼", "Kyrgyzstan": "🇰🇬",
    "Laos": "🇱🇦", "Latvia": "🇱🇻", "Lebanon": "🇱🇧", "Libya": "🇱🇾", "Lithuania": "🇱🇹",
    "Luxembourg": "🇱🇺", "Madagascar": "🇲🇬", "Malaysia": "🇲🇾", "Maldives": "🇲🇻", "Mali": "🇲🇱",
    "Malta": "🇲🇹", "Mexico": "🇲🇽", "Moldova": "🇲🇩", "Monaco": "🇲🇨", "Mongolia": "🇲🇳",
    "Montenegro": "🇲🇪", "Morocco": "🇲🇦", "Mozambique": "🇲🇿", "Myanmar": "🇲🇲", "Namibia": "🇳🇦",
    "Nepal": "🇳🇵", "Netherlands": "🇳🇱", "New Zealand": "🇳🇿", "Nicaragua": "🇳🇮", "Niger": "🇳🇪",
    "Nigeria": "🇳🇬", "North Korea": "🇰🇵", "Norway": "🇳🇴", "Oman": "🇴🇲", "Pakistan": "🇵🇰",
    "Palestine": "🇵🇸", "Panama": "🇵🇦", "Paraguay": "🇵🇾", "Peru": "🇵🇪", "Philippines": "🇵🇭",
    "Poland": "🇵🇱", "Portugal": "🇵🇹", "Qatar": "🇶🇦", "Romania": "🇷🇴", "Russia": "🇷🇺",
    "Rwanda": "🇷🇼", "Saudi Arabia": "🇸🇦", "Senegal": "🇸🇳", "Serbia": "🇷🇸", "Singapore": "🇸🇬",
    "Slovakia": "🇸🇰", "Slovenia": "🇸🇮", "Somalia": "🇸🇴", "South Africa": "🇿🇦", "South Korea": "🇰🇷",
    "Spain": "🇪🇸", "Sri Lanka": "🇱🇰", "Sudan": "🇸🇩", "Sweden": "🇸🇪", "Switzerland": "🇨🇭",
    "Syria": "🇸🇾", "Taiwan": "🇹🇼", "Tajikistan": "🇹🇯", "Tanzania": "🇹🇿", "Thailand": "🇹🇭",
    "Togo": "🇹🇬", "Tunisia": "🇹🇳", "Turkey": "🇹🇷", "Turkmenistan": "🇹🇲", "Uganda": "🇺🇬",
    "Ukraine": "🇺🇦", "United Arab Emirates": "🇦🇪", "United Kingdom": "🇬🇧", "United States": "🇺🇸",
    "Uruguay": "🇺🇾", "Uzbekistan": "🇺🇿", "Venezuela": "🇻🇪", "Vietnam": "🇻🇳", "Yemen": "🇾🇪",
    "Zambia": "🇿🇲", "Zimbabwe": "🇿🇼",
  };
  return map[name] || "🌍";
}

const SUSPENSION_REASONS = [
  "Spam Activity",
  "Fake Account / Impersonation",
  "Harassment or Bullying",
  "Hate Speech",
  "Inappropriate Content",
  "Copyright Violation",
  "Fraud / Scam Activity",
  "Other (Custom Reason)",
];

export default function AllUsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const userTypeFilter = pathname.includes('/sellers')
    ? 'Seller'
    : pathname.includes('/employees')
      ? 'Employee'
      : undefined;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ user_id: '', user_type: 'seller', username: '', full_name: '', email: '', password: '', confirm_password: '' });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("highest");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [deactivateCategory, setDeactivateCategory] = useState("");
  const [deactivateCustomReason, setDeactivateCustomReason] = useState("");
  const [restoreConfirmUser, setRestoreConfirmUser] = useState<User | null>(null);
  const [accessUser, setAccessUser] = useState<User | null>(null);
  const [walletAccessChecked, setWalletAccessChecked] = useState(false);
  const [showGoogerTransferModal, setShowGoogerTransferModal] = useState(false);
  const [transferTargetAdmin, setTransferTargetAdmin] = useState<number | null>(null);
  const [googerTransferAmount, setGoogerTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  
  useEffect(() => {
    const loadInitialData = async (isPolling = false) => {
      try {
        if (!isPolling) setLoading(true);
        const [usersData, statsData] = await Promise.all([
          adminService.fetchAllUsers(),
          adminService.fetchStats().catch(() => null)
        ]);
        setUsers(usersData || []);
        setStats(statsData);
        if (!isPolling) setError(null);
      } catch (err: any) {
        console.error(err);
        if (!isPolling) setError(err.message);
      } finally {
        if (!isPolling) setLoading(false);
      }
    };

    loadInitialData(false);
    const interval = setInterval(() => loadInitialData(true), 30000);
    return () => clearInterval(interval);
  }, [userTypeFilter]);

  const normalizedUserType = (u: User) => u.user_type?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  const isSuperAdmin = (u: User) => normalizedUserType(u) === 'super_admin' || normalizedUserType(u) === 'superadmin' || u.username?.toLowerCase() === 'superadmin';
  const isSystemAdmin = (u: User) => u.username?.toLowerCase() === 'admin';
  const isProtectedAdmin = (u: User) => isSystemAdmin(u) || isSuperAdmin(u);
  const isSuspendedUser = (u: User) => u.is_deactivated === true || u.status === 'Deactivated';

  const typeFilteredUsers = userTypeFilter
    ? users.filter(user => !isSystemAdmin(user) && user.user_type && user.user_type.toLowerCase() === userTypeFilter.toLowerCase())
    : users.filter(user => !isSystemAdmin(user));

  const dashboardUserBalance = Number(stats?.totalUsersBalance);
  const totalUserBalance = Number.isFinite(dashboardUserBalance)
    ? dashboardUserBalance
    : 0;

  const availableGoogerBalance = parseFloat(String(stats?.googerBalance || 0));
  const displayBalance = Number.isFinite(availableGoogerBalance) ? availableGoogerBalance : 0;
  const transferableUsers = users.filter(u => !isProtectedAdmin(u) && ['admin', 'super_admin'].includes(normalizedUserType(u)));

  const availableCountries = Array.from(
    new Set(typeFilteredUsers.map(u => u.country).filter(Boolean))
  ).sort() as string[];

  const filteredUsers = typeFilteredUsers.filter(user => {
    if (selectedCountry && user.country !== selectedCountry) return false;
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (user.user_id && user.user_id.toLowerCase().includes(search)) ||
      (user.username && user.username.toLowerCase().includes(search)) ||
      (user.full_name && user.full_name.toLowerCase().includes(search)) ||
      (user.email && user.email.toLowerCase().includes(search))
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === "highest") return parseFloat(b.wallet_balance || '0') - parseFloat(a.wallet_balance || '0');
    if (sortBy === "lowest") return parseFloat(a.wallet_balance || '0') - parseFloat(b.wallet_balance || '0');
    return 0;
  });

  const handleRestoreUser = async () => {
    if (!restoreConfirmUser) return;
    try {
      setLoading(true);
      await adminService.restoreUser(restoreConfirmUser.id.toString());
      setUsers(users.map(u => u.id === restoreConfirmUser.id ? { ...u, status: 'Active', is_deactivated: false } : u));
      setRestoreConfirmUser(null);
    } catch (err: any) {
      alert("Error restoring account: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openWalletAccess = (user: User) => {
    setAccessUser(user);
    setWalletAccessChecked(Boolean(user.suspended_wallet_access));
  };

  const handleWalletAccess = async () => {
    if (!accessUser) return;
    try {
      setLoading(true);
      const result = await adminService.updateSuspendedWalletAccess(accessUser.id, walletAccessChecked);
      const updatedUser = result?.user || { ...accessUser, suspended_wallet_access: walletAccessChecked };
      setUsers(users.map(u => u.id === accessUser.id ? updatedUser : u));
      setAccessUser(null);
    } catch (err: any) {
      alert("Error updating wallet access: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAdmin = (admin: User) => {
    setTransferTargetAdmin(admin.id);
  };

  const handleGoogerTransfer = async () => {
    if (!transferTargetAdmin || !googerTransferAmount || isNaN(Number(googerTransferAmount)) || Number(googerTransferAmount) <= 0) {
      alert("Please select an admin and enter a valid amount.");
      return;
    }

    try {
      setTransferLoading(true);
      await adminService.transferGoogerToAdmin(transferTargetAdmin, Number(googerTransferAmount));
      alert("Transfer successful!");
      setShowGoogerTransferModal(false);
      setTransferTargetAdmin(null);
      setGoogerTransferAmount('');
      const [usersData, statsData] = await Promise.all([
        adminService.fetchAllUsers(),
        adminService.fetchStats().catch(() => null)
      ]);
      setUsers(usersData || []);
      setStats(statsData);
    } catch (err: any) {
      alert("Transfer failed: " + err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleAddUser = async () => {
    setAddUserError(null);
    const { user_id, user_type, username, full_name, email, password, confirm_password } = newUserData;
    if (!user_id || !user_type || !username || !full_name || !email || !password || !confirm_password) {
      setAddUserError('Please fill in all fields.');
      return;
    }
    if (!/^\d{6}$/.test(user_id)) {
      setAddUserError('User ID must be exactly 6 digits.');
      return;
    }
    if (password !== confirm_password) {
      setAddUserError('Passwords do not match.');
      return;
    }
    try {
      setAddUserLoading(true);
      await adminService.createUser({ user_id, user_type, username, full_name, email, password, confirm_password });
      setShowAddModal(false);
      setNewUserData({ user_id: '', user_type: 'seller', username: '', full_name: '', email: '', password: '', confirm_password: '' });
      const usersData = await adminService.fetchAllUsers();
      setUsers(usersData || []);
    } catch (err: any) {
      setAddUserError(err.message);
    } finally {
      setAddUserLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
            {userTypeFilter ? `${userTypeFilter}s Management` : "All Users Management"}
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            {userTypeFilter 
              ? `Manage and view all registered ${userTypeFilter.toLowerCase()}s in the ecosystem.`
              : "Manage and view all registered users in the ecosystem."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="h-12 bg-white hover:bg-gray-200 text-black px-6 py-3 rounded-2xl transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-lg shadow-white/10"
          >
            <IonIcon name="person-add-outline" className="text-lg" />
            Add New User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-[2rem] p-5 sm:p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
              Total {userTypeFilter ? `${userTypeFilter}s` : "Users"} Balance
            </p>
            <h3 className="text-2xl font-black text-white">R {totalUserBalance.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
            <IonIcon name="wallet-outline" className="text-2xl text-blue-400" />
          </div>
        </div>
        <div
          onClick={() => setShowGoogerTransferModal(true)}
          className="bg-emerald-600/10 border border-emerald-500/20 rounded-[2rem] p-6 flex flex-1 items-center justify-between cursor-pointer hover:bg-emerald-600/20 hover:border-emerald-500/40 transition-all active:scale-[0.98] group relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10 w-full flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 group-hover:text-emerald-300 transition-colors">
                Googer Balance
              </p>
              <h3 className="text-2xl font-black text-white">R {displayBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 group-hover:rotate-12 transition-transform duration-300">
              <IonIcon name="business-outline" className="text-2xl text-emerald-400 group-hover:text-emerald-300" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] relative min-h-[500px] shadow-2xl overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-[2rem]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
          </div>
        )}

        <div className="p-4 sm:p-6 border-b border-[#1a1a1a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
              <IonIcon name="search-outline" className="text-lg" />
            </div>
            <input
              type="text"
              placeholder="Search User ID, Name, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
             <div className="relative">
                <button 
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    className="h-11 px-4 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-500/30 transition-all flex items-center gap-2"
                >
                    <IonIcon name="swap-vertical-outline" className="text-sm" />
                    {sortBy === 'highest' ? 'All Users' : sortBy === 'newest' ? 'New Users' : sortBy === 'oldest' ? 'Oldest Users' : 'Lowest Balance'}
                </button>
                
                {isSortOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsSortOpen(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-56 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl z-[70] py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-4 py-2 border-b border-white/5 mb-1">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Grouping</p>
                            </div>
                            <button 
                                onClick={() => { setSortBy("highest"); setIsSortOpen(false); }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'highest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <IonIcon name="people-outline" /> All Users
                            </button>
                            <button 
                                onClick={() => { setSortBy("newest"); setIsSortOpen(false); }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'newest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <IonIcon name="sparkles-outline" /> New Users
                            </button>
                            
                            <div className="px-4 py-2 border-b border-t border-white/5 my-1">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sorting</p>
                            </div>
                            <button 
                                onClick={() => { setSortBy("highest"); setIsSortOpen(false); }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'highest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <IonIcon name="trending-up-outline" /> Highest Balance
                            </button>
                            <button 
                                onClick={() => { setSortBy("lowest"); setIsSortOpen(false); }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'lowest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <IonIcon name="trending-down-outline" /> Lowest Balance
                            </button>
                            <button 
                                onClick={() => { setSortBy("oldest"); setIsSortOpen(false); }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'oldest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <IonIcon name="hourglass-outline" /> Oldest Users
                            </button>
                        </div>
                    </>
                )}
            </div>
            {/* Country Filter */}
            <div className="relative">
              <button
                onClick={() => { setIsCountryOpen(!isCountryOpen); setCountrySearch(""); }}
                className={`h-11 px-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${selectedCountry ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "bg-white/5 border-white/5 text-slate-400 hover:border-blue-500/30"}`}
              >
                {selectedCountry ? (
                  <><span className="text-base">{countryFlag(selectedCountry)}</span>{selectedCountry}</>
                ) : (
                  <><IonIcon name="globe-outline" className="text-sm" />Country</>
                )}
                {selectedCountry && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setSelectedCountry(""); }}
                    className="ml-1 text-blue-300 hover:text-white cursor-pointer"
                  >✕</span>
                )}
              </button>

              {isCountryOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setIsCountryOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-white/5">
                      <input
                        autoFocus
                        value={countrySearch}
                        onChange={e => setCountrySearch(e.target.value)}
                        placeholder="Search country..."
                        className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500/30"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      <button
                        onClick={() => { setSelectedCountry(""); setIsCountryOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${!selectedCountry ? "text-blue-400 bg-white/5" : "text-slate-400 hover:bg-white/5"}`}
                      >
                        <span className="text-base">🌍</span> All Countries
                        <span className="ml-auto text-slate-600 font-normal normal-case">{typeFilteredUsers.length}</span>
                      </button>
                      {availableCountries
                        .filter(c => !countrySearch || c.toLowerCase().includes(countrySearch.toLowerCase()))
                        .map(country => {
                          const count = typeFilteredUsers.filter(u => u.country === country).length;
                          return (
                            <button
                              key={country}
                              onClick={() => { setSelectedCountry(country); setIsCountryOpen(false); setCountrySearch(""); }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${selectedCountry === country ? "text-blue-400 bg-white/5" : "text-slate-400 hover:bg-white/5"}`}
                            >
                              <span className="text-base">{countryFlag(country)}</span>
                              <span className="truncate">{country}</span>
                              <span className="ml-auto text-slate-600 font-normal normal-case shrink-0">{count}</span>
                            </button>
                          );
                        })}
                      {availableCountries.filter(c => !countrySearch || c.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 && (
                        <p className="px-4 py-3 text-[10px] text-slate-600">No countries found</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

             <div className="px-4 py-2 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sortedUsers.length} Users</span>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#1a1a1a]/50 text-slate-300 text-[9px] font-black uppercase tracking-[0.2em]">
                <th className="px-6 py-5">User Information</th>
                <th className="px-6 py-5 text-center">Wallet Balance</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center text-slate-500 font-medium italic">
                    {searchTerm ? `No users found matching "${searchTerm}"` : "No users registered yet."}
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-all group">
                    <td className="px-6 py-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 overflow-hidden shrink-0">
                          <IonIcon name="person" className="text-xl" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/admin/users/${user.id}?returnTo=${pathname}&from=Users`}
                              className="font-bold text-white text-sm hover:text-blue-400 transition-colors"
                            >
                              {normalizedUserType(user) === 'admin' || isSuperAdmin(user) ? `@${user.username}` : user.full_name}
                            </Link>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {user.user_id}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Link href={`/admin/users/${user.id}`} className="text-xs text-slate-400 font-medium tracking-tight hover:text-blue-400 transition-colors">@{user.username}</Link>
                            <span className="text-[11px] text-slate-500 italic mt-0.5">{user.email}</span>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`px-3 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                isSuperAdmin(user) ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                normalizedUserType(user) === 'admin' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                user.user_type?.toLowerCase() === 'seller' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                user.user_type?.toLowerCase() === 'employee' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                user.user_type?.toLowerCase() === 'buyer' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                'bg-white/5 text-slate-400 border-white/5'
                              }`}>
                                {isSuperAdmin(user) ? 'Super Admin' :
                                 normalizedUserType(user) === 'admin' ? 'Admin' :
                                 user.user_type?.toLowerCase() === 'seller' ? 'Seller' :
                                 user.user_type?.toLowerCase() === 'employee' ? 'Employee' :
                                 user.user_type?.toLowerCase() === 'buyer' ? 'Buyer' : 'User'}
                              </span>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{user.status}</span>
                            </div>
                            {user.country && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-sm leading-none">{countryFlag(user.country)}</span>
                                <span className="text-[10px] text-slate-500 font-medium">{user.country}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-black text-white">R {isSuperAdmin(user) ? '0' : parseFloat(user.wallet_balance || '0').toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[8px] font-black uppercase tracking-widest hover:border-blue-500/30 hover:text-blue-400 transition-all flex items-center gap-2 shrink-0"
                        >
                          <IonIcon name="person-outline" className="text-sm" />
                          <span className="hidden lg:inline">View Full Profile</span>
                          <span className="lg:hidden">View</span>
                        </Link>
                        {!isProtectedAdmin(user) && (
                          <>
                            <button
                              onClick={() => openWalletAccess(user)}
                              className={`h-10 px-3 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${
                                user.suspended_wallet_access
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/20'
                              }`}
                            >
                              <IonIcon name={user.suspended_wallet_access ? "wallet" : "key-outline"} className="text-sm" />
                              <span className="hidden lg:inline">Give Access</span>
                              <span className="lg:hidden">Access</span>
                            </button>
                            <button
                              onClick={() => {
                                if (!isSuspendedUser(user)) {
                                  setDeactivateCategory("");
                                  setDeactivateCustomReason("");
                                  setDeleteConfirmUser(user);
                                } else {
                                  setRestoreConfirmUser(user);
                                }
                              }}
                              className={`h-10 px-3 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${
                                !isSuspendedUser(user)
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              }`}
                            >
                              <IonIcon name={!isSuspendedUser(user) ? "close-circle-outline" : "checkmark-circle-outline"} className="text-sm" />
                              <span className="hidden lg:inline">{!isSuspendedUser(user) ? 'Deactivate Account' : 'Activate Account'}</span>
                              <span className="lg:hidden">{user.status === 'Active' ? 'Deactivate' : 'Activate'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { if (!addUserLoading) { setShowAddModal(false); setAddUserError(null); } }}></div>
          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] w-full max-w-sm p-6 relative z-[110] shadow-2xl animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Add New User</h3>
              <button onClick={() => { if (!addUserLoading) { setShowAddModal(false); setAddUserError(null); } }} className="text-slate-500 hover:text-white transition-colors">
                <IonIcon name="close" />
              </button>
            </div>

            <div className="space-y-3">
              {/* User ID */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">User ID <span className="text-slate-600 normal-case">(6 digits)</span></label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg px-3 py-2 text-xs text-white focus:border-white/50 outline-none transition-all font-mono tracking-widest"
                  placeholder="e.g. 123456"
                  value={newUserData.user_id}
                  onChange={e => setNewUserData({...newUserData, user_id: e.target.value.replace(/\D/g, '')})}
                />
              </div>

              {/* Role */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Role</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['seller', 'buyer', 'employee', 'admin'].map(role => (
                    <button
                      key={role}
                      onClick={() => setNewUserData({...newUserData, user_type: role})}
                      className={`py-2 rounded-lg border text-[8px] font-black uppercase tracking-wider transition-all ${
                        newUserData.user_type === role
                          ? role === 'admin'    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                          : role === 'seller'   ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                          : role === 'employee' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          :                      'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-black border-[#1a1a1a] text-slate-600 hover:border-white/20 hover:text-slate-400'
                      }`}
                    >
                      {role === 'employee' ? 'Emp.' : role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Full Name</label>
                <input
                  type="text"
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg px-3 py-2 text-xs text-white focus:border-white/50 outline-none transition-all"
                  placeholder="Enter full name"
                  value={newUserData.full_name}
                  onChange={e => setNewUserData({...newUserData, full_name: e.target.value})}
                />
              </div>

              {/* Username */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Username</label>
                <input
                  type="text"
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg px-3 py-2 text-xs text-white focus:border-white/50 outline-none transition-all"
                  placeholder="Enter username"
                  value={newUserData.username}
                  onChange={e => setNewUserData({...newUserData, username: e.target.value})}
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg px-3 py-2 text-xs text-white focus:border-white/50 outline-none transition-all"
                  placeholder="name@example.com"
                  value={newUserData.email}
                  onChange={e => setNewUserData({...newUserData, email: e.target.value})}
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Password</label>
                <input
                  type="password"
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg px-3 py-2 text-xs text-white focus:border-white/50 outline-none transition-all"
                  placeholder="Min. 8 characters"
                  value={newUserData.password}
                  onChange={e => setNewUserData({...newUserData, password: e.target.value})}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Confirm Password</label>
                <input
                  type="password"
                  className={`w-full bg-black border rounded-lg px-3 py-2 text-xs text-white focus:border-white/50 outline-none transition-all ${
                    newUserData.confirm_password && newUserData.password !== newUserData.confirm_password
                      ? 'border-rose-500/50'
                      : 'border-[#1a1a1a]'
                  }`}
                  placeholder="Re-enter password"
                  value={newUserData.confirm_password}
                  onChange={e => setNewUserData({...newUserData, confirm_password: e.target.value})}
                />
                {newUserData.confirm_password && newUserData.password !== newUserData.confirm_password && (
                  <p className="text-[9px] text-rose-400 font-black mt-1 uppercase tracking-widest">Passwords do not match</p>
                )}
              </div>

              {addUserError && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-rose-400 font-bold">{addUserError}</p>
                </div>
              )}

              <button
                onClick={handleAddUser}
                disabled={addUserLoading}
                className="w-full bg-white disabled:bg-white/30 disabled:text-black/40 text-black font-black text-[9px] uppercase tracking-widest py-3 rounded-lg mt-1 hover:bg-gray-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {addUserLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGoogerTransferModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setShowGoogerTransferModal(false)}
          />
          <div className="bg-[#09090b] border border-emerald-500/20 rounded-[2rem] w-full max-w-sm p-5 relative z-[310] shadow-2xl shadow-emerald-900/20 animate-in fade-in zoom-in-95 duration-300 max-h-[82vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <IonIcon name="business-outline" className="text-base" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider leading-tight">Googer Transfer</h3>
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Available R {displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              <button onClick={() => setShowGoogerTransferModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <IonIcon name="close" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Select Transfer Target</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {transferableUsers.length === 0 ? (
                    <div className="p-3 border border-dashed border-white/10 rounded-xl text-center">
                      <p className="text-[10px] text-slate-500 italic">No users available.</p>
                    </div>
                  ) : (
                    transferableUsers.map(u => (
                      <div
                        key={u.id}
                        onClick={() => handleSelectAdmin(u)}
                        className={`px-3 py-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          transferTargetAdmin === u.id
                            ? 'bg-emerald-500/10 border-emerald-500/40'
                            : 'bg-[#0c0c0e] border-[#1a1a1a] hover:border-white/10 hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${transferTargetAdmin === u.id ? 'text-white' : 'text-slate-300'}`}>{u.user_type?.toLowerCase() === 'admin' ? `@${u.username}` : u.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[8px] font-black uppercase tracking-widest ${transferTargetAdmin === u.id ? 'text-emerald-400' : 'text-slate-600'}`}>{u.user_type}</span>
                            <span className={`text-[8px] font-mono ${transferTargetAdmin === u.id ? 'text-emerald-400/50' : 'text-slate-700'}`}>#{u.user_id}</span>
                          </div>
                        </div>
                        {transferTargetAdmin === u.id && (
                          <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Transfer Amount</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R</div>
                  <input
                    type="number"
                    className="w-full bg-[#0c0c0e] border border-[#1a1a1a] rounded-xl pl-8 pr-14 py-3 text-white font-bold text-sm focus:border-emerald-500/50 outline-none transition-all font-mono placeholder:text-slate-700"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={googerTransferAmount}
                    onChange={e => setGoogerTransferAmount(e.target.value)}
                  />
                  <button
                    onClick={() => setGoogerTransferAmount(displayBalance.toFixed(2))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase tracking-widest text-emerald-400 hover:text-white hover:bg-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded-lg transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>

              <button
                onClick={handleGoogerTransfer}
                disabled={transferLoading || !transferTargetAdmin || !googerTransferAmount || Number(googerTransferAmount) <= 0}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/30 disabled:text-emerald-400/50 text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {transferLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <IonIcon name="send-outline" className="text-sm" />
                    Complete Transfer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {accessUser && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setAccessUser(null)} />
          <div className="relative z-[310] w-full max-w-sm rounded-[2rem] border border-violet-500/20 bg-[#0c0c0e] p-6 shadow-2xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/10 text-violet-300">
                <IonIcon name="key-outline" className="text-xl" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Give Access</h3>
                <p className="text-xs font-bold text-white/40">@{accessUser.username}</p>
              </div>
            </div>

            <label className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${walletAccessChecked ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black text-white/70">
                  <IonIcon name="wallet-outline" className="text-lg" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Wallet</p>
                  <p className="text-[10px] font-bold text-white/40">Allow My Wallet page only after deactivation</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={walletAccessChecked}
                onChange={(e) => setWalletAccessChecked(e.target.checked)}
                className="h-5 w-5 accent-emerald-500"
              />
            </label>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/35">User Wallet Balance</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xs font-black text-emerald-300">R</span>
                <span className="text-2xl font-black text-white">
                  {Number(accessUser.wallet_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setAccessUser(null)}
                className="h-12 flex-1 rounded-2xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/45 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={handleWalletAccess}
                className="h-12 flex-1 rounded-2xl border border-emerald-500/25 bg-emerald-500/15 text-[10px] font-black uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/25"
              >
                Give Access
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Deactivate/Delete Pipeline Confirmation Modal (from All Users) */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300" 
            onClick={() => setDeleteConfirmUser(null)}
          ></div>
          <div className="bg-[#0c0c0e] border border-rose-500/20 rounded-[2.5rem] w-full max-w-sm p-8 relative z-[210] shadow-[0_50px_100px_-20px_rgba(255,0,0,0.1)] animate-in fade-in zoom-in-95 duration-300 overflow-hidden text-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-rose-500/10 blur-3xl -mt-16 opacity-30"></div>
            
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-500 animate-pulse">
              <IonIcon name="close-circle-outline" className="text-4xl" />
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-3">Deactivate Account?</h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
              Are you sure you want to deactivate <span className="text-white font-bold">{deleteConfirmUser.user_type?.toLowerCase() === 'admin' ? `@${deleteConfirmUser.username}` : deleteConfirmUser.full_name}</span>'s account? 
              <br/><br/>
              They will be moved to the <span className="text-rose-400 font-bold">Deactivated Users</span> list with a <span className="text-white font-bold">7 day temporary suspension</span>.
            </p>

            <div className="mb-5 text-left">
              <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">Reason Category</label>
              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1">
                {SUSPENSION_REASONS.map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setDeactivateCategory(reason)}
                    className={`rounded-xl border px-3 py-2 text-left text-[10px] font-bold transition-all ${deactivateCategory === reason ? "border-rose-400/50 bg-rose-500/15 text-rose-200" : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"}`}
                  >
                    <span className="text-rose-400">🚫</span> {reason}
                  </button>
                ))}
              </div>
              {deactivateCategory === "Other (Custom Reason)" && (
                <textarea
                  value={deactivateCustomReason}
                  onChange={(e) => setDeactivateCustomReason(e.target.value)}
                  rows={3}
                  placeholder="Enter custom reason..."
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-rose-500/40"
                />
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={async () => {
                    try {
                        setLoading(true);
                        await adminService.deactivateUser(deleteConfirmUser.id, true, deactivateCategory, {
                          category: deactivateCategory,
                          customReason: deactivateCustomReason.trim(),
                        });
                        // Move users from list after deactivation
                        setUsers(users.filter(u => u.id !== deleteConfirmUser.id));
                        setDeleteConfirmUser(null);
                        router.push('/admin/users/deactivated');
                    } catch (err: any) {
                        alert("Error: " + err.message);
                    } finally {
                        setLoading(false);
                    }
                }}
                disabled={!deactivateCategory || (deactivateCategory === "Other (Custom Reason)" && !deactivateCustomReason.trim())}
                className="h-14 rounded-2xl bg-rose-500 text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-400 transition-all active:scale-95 shadow-lg shadow-rose-500/20 disabled:opacity-40"
              >
                Confirm Deactivate
              </button>
              <button 
                onClick={() => { setDeleteConfirmUser(null); setDeactivateCategory(""); setDeactivateCustomReason(""); }}
                className="h-12 rounded-2xl bg-white/5 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-95"
              >
                Keep Active
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreConfirmUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300" 
            onClick={() => setRestoreConfirmUser(null)}
          ></div>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] w-full max-w-sm p-8 relative z-[210] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-300 overflow-hidden text-center">
            <div className="absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 opacity-20 bg-emerald-500"></div>
            
            <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center border animate-bounce bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
              <IonIcon name="checkmark-circle-outline" className="text-3xl" />
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Reactivate Account?</h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
              Restore access for <span className="text-white font-bold">{restoreConfirmUser.user_type?.toLowerCase() === 'admin' ? `@${restoreConfirmUser.username}` : restoreConfirmUser.full_name}</span>? 
              This will remove them from the deletion pipeline.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setRestoreConfirmUser(null)} className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95">Cancel</button>
              <button 
                onClick={handleRestoreUser}
                className="flex-1 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/20 shadow-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
