"use client";

import { useEffect, useState } from "react";
import IonIcon from "../components/IonIcon";
import { adminService } from "../services/adminService";

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await adminService.fetchStats();
        setData(stats);
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const stats = [
    { name: "Total Users", value: data?.totalUsers || "0", icon: "people", color: "text-blue-500", bg: "bg-blue-500/10" },
    { name: "Active Sellers", value: data?.activeSellers || "0", icon: "storefront", color: "text-purple-500", bg: "bg-purple-500/10" },
    { name: "Total Balance", value: `R ${parseFloat(data?.totalRevenue || 0).toLocaleString()}`, icon: "cash", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { name: "Pending Products", value: data?.pendingProducts || "0", icon: "bag-handle", color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard Overview</h1>
        <p className="text-slate-400 mt-1 md:mt-2 text-sm">Welcome back, Admin. Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-[#09090b] border border-[#1a1a1a] rounded-2xl p-6 hover:border-white/20 transition-all group">
            <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center text-2xl mb-4`}>
              <IonIcon name={stat.icon + "-outline"} />
            </div>
            <p className="text-slate-400 text-sm font-medium">{stat.name}</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
            <div className="flex items-center gap-1 mt-2 text-xs text-emerald-400">
              <IonIcon name="trending-up" />
              <span>+12.5% from last week</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#09090b] border border-[#1a1a1a] rounded-2xl p-4 md:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h3 className="text-lg md:text-xl font-bold text-white">Platform Activity</h3>
            <select className="bg-black border border-[#1a1a1a] rounded-lg px-3 py-1.5 text-xs text-slate-300">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-64 flex items-end justify-between gap-2 px-2">
            {[40, 70, 45, 90, 65, 80, 50, 95, 60, 75, 55, 85].map((val, i) => (
              <div key={i} className="flex-1 space-y-2 group">
                <div className="relative h-full flex flex-col justify-end">
                  <div 
                    className="w-full bg-blue-600 rounded-t-sm group-hover:bg-blue-400 transition-all cursor-pointer" 
                    style={{ height: `${val}%` }}
                    title={`$${val * 100}`}
                  ></div>
                </div>
                <span className="block text-[8px] text-slate-600 text-center uppercase">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#09090b] border border-[#1a1a1a] rounded-2xl p-6 md:p-8">
          <h3 className="text-lg md:text-xl font-bold text-white mb-6">Recent Requests</h3>
          <div className="space-y-6">
            {[
              { name: "Top-up Request", user: "John Doe", amount: "$50.00", time: "2 min ago" },
              { name: "ID Verification", user: "Jane Smith", amount: "Pending", time: "15 min ago" },
              { name: "Coin Request", user: "Mike Ross", amount: "1000 Coins", time: "1 hour ago" },
            ].map((req, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center shrink-0">
                  <IonIcon name="document-text-outline" className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{req.name}</p>
                  <p className="text-xs text-slate-500">From {req.user}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-white">{req.amount}</p>
                  <p className="text-[10px] text-slate-600 uppercase mt-1">{req.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-3 rounded-xl bg-white text-black hover:bg-gray-200 text-sm font-bold transition-colors">
            View All Requests
          </button>
        </div>
      </div>
    </div>
  );
}
