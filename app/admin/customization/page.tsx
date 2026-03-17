"use client";

import { useState } from "react";
import IonIcon from "../../components/IonIcon";

export default function CustomizationPage() {
  const [activeTab, setActiveTab] = useState('categories');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Percentage Customization</h1>
          <p className="text-slate-400">Configure commissions, fees, and referral systems.</p>
        </div>
      </div>

      <div className="flex border-b border-slate-800 gap-8">
        <button 
          className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'categories' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setActiveTab('categories')}
        >
          Category Commission
          {activeTab === 'categories' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>}
        </button>
        <button 
          className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'referral' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setActiveTab('referral')}
        >
          Referral & Commissions
          {activeTab === 'referral' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>}
        </button>
        <button 
          className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'fees' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setActiveTab('fees')}
        >
          Wallet & Fees
          {activeTab === 'fees' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>}
        </button>
      </div>

      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((level) => (
            <div key={level} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Level {level} Categories</h3>
                <button className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                  <IonIcon name="add-circle-outline" /> Add
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {['Fashion', 'Electronics', 'Home'].map((cat, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-slate-800/50 rounded-lg group">
                    <span className="text-sm">{cat} {level > 1 ? `${level}` : ''}</span>
                    <button className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IonIcon name="trash-outline" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-slate-800">
                <label className="text-xs text-slate-500 uppercase font-bold">Google Commission (%)</label>
                <div className="flex items-center gap-3 mt-1">
                  <input 
                    type="number" 
                    placeholder="E.g. 5" 
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button className="bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold text-white">Save</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'referral' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 max-w-2xl">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Referral Multiplier</label>
                <input type="text" defaultValue="1.5x" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Ad Click Commission</label>
                <input type="text" defaultValue="$0.05" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Pre-ad Commission</label>
                <input type="text" defaultValue="2%" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">General Category Commission</label>
                <input type="text" defaultValue="10%" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white" />
              </div>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all">Update Referral Settings</button>
          </div>
        </div>
      )}

      {activeTab === 'fees' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 max-w-2xl">
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white">Wallet Fees Configuration</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-xl">
                <div>
                  <p className="font-medium">Withdrawal Fee</p>
                  <p className="text-xs text-slate-500">Service charge per withdrawal</p>
                </div>
                <div className="w-24">
                  <input type="text" defaultValue="3%" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-right" />
                </div>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-xl">
                <div>
                  <p className="font-medium">Transfer Fee</p>
                  <p className="text-xs text-slate-500">P2P wallet transfer fee</p>
                </div>
                <div className="w-24">
                  <input type="text" defaultValue="0.5%" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-right" />
                </div>
              </div>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all w-full">Save Fee Structure</button>
          </div>
        </div>
      )}
    </div>
  );
}
