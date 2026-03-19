"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import IonIcon from '@/components/IonIcon';
import { authService } from '@/services/authService';
import { walletService } from '@/services/walletService';
import { adminService } from '@/services/adminService';

export default function WalletSystemTopup() {
    const router = useRouter();
    
    // Auth & Verification States
    const [isVerified, setIsVerified] = useState(false);
    const [authStep, setAuthStep] = useState(1); // 1: Credentials, 2: Verification
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Wallet States
    const [userBalance, setUserBalance] = useState(0);
    const [googerBalance, setGoogerBalance] = useState(0);
    const [transferAmount, setTransferAmount] = useState('');
    const [isTransferring, setIsTransferring] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // Re-authenticate user
            await authService.login({ email: username, password });
            setAuthStep(2); // Proceed to OTP verification Step
            
            // DEV OVERRIDE: Auto-fill verification for debugging
            setPhone('+1 (555) 000-0000');
            setOtp('123456');
            
        } catch (err: any) {
            setError(err.message || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!phone || !otp) {
            setError('Phone number and OTP are required');
            return;
        }

        setLoading(true);
        // OTP validation logic (simulated for security checkpoint)
        setTimeout(() => {
            if (otp.length >= 4) {
                setIsVerified(true);
                fetchBalances();
            } else {
                setError('Invalid OTP code. Enter at least 4 digits.');
            }
            setLoading(false);
        }, 1000);
    };

    const fetchBalances = async () => {
        try {
            const profile = await authService.getProfile();
            setUserBalance(parseFloat(profile.wallet_balance) || 0);

            const stats = await adminService.fetchStats();
            setGoogerBalance(stats.googerBalance || 0);
        } catch (err) {
            console.error('Error fetching balances:', err);
        }
    };

    const handleTransfer = async () => {
        if (!transferAmount || isNaN(Number(transferAmount)) || Number(transferAmount) <= 0) {
            alert('Please enter a valid amount to transfer.');
            return;
        }
        
        setIsTransferring(true);
        try {
            await walletService.transferToGooger(Number(transferAmount), 'Wallet System Transfer to Main Googer Balance');
            alert('Successfully transferred funds to Main Googer Balance!');
            setTransferAmount('');
            fetchBalances();
        } catch (err: any) {
            alert(err.message || 'Transfer failed');
        } finally {
            setIsTransferring(false);
        }
    };

    return (
        <div className="pb-10 relative min-h-screen flex flex-col items-center pt-10 px-4">
            <div className="w-full max-w-xl">
                <div className="mb-6 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                    >
                        <IonIcon name="chevron-back-outline" className="text-xl" />
                        <span className="text-[11px] font-bold uppercase tracking-widest">Back</span>
                    </button>
                    <h1 className="text-2xl font-bold text-white">Wallet & Top-Up System</h1>
                    <div className="w-10"></div>
                </div>

                {!isVerified ? (
                    <div className="bg-[#162033] border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                        {/* Background effect */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                        
                        <div className="text-center mb-8 relative z-10">
                            <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                                <IonIcon name={authStep === 1 ? "lock-closed" : "shield-checkmark"} className="text-3xl" />
                            </div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Admin Wallet Access</h2>
                            <p className="text-gray-400 text-sm mt-2">
                                {authStep === 1 ? 'Please authenticate to access the wallet system' : 'Complete 2-Step Verification'}
                            </p>
                        </div>

                        {error && (
                            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm p-4 rounded-xl mb-6 flex items-center gap-3">
                                <IonIcon name="alert-circle" className="text-xl" />
                                {error}
                            </div>
                        )}

                        {authStep === 1 ? (
                            <form onSubmit={handleLogin} className="space-y-5 relative z-10">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Username / Email</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                                            <IonIcon name="person" />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full bg-[#0d1421] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                            placeholder="Enter registered username or email"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Password</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                                            <IonIcon name="key" />
                                        </div>
                                        <input 
                                            type="password" 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-[#0d1421] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                            placeholder="Enter password"
                                            required
                                        />
                                    </div>
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-blue-600/20 mt-4 disabled:opacity-50"
                                >
                                    {loading ? 'Authenticating...' : 'Sign In & Continue'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerify} className="space-y-5 relative z-10">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Phone Number</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                                            <IonIcon name="call" />
                                        </div>
                                        <input 
                                            type="tel" 
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full bg-[#0d1421] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                            placeholder="+1 (555) 000-0000"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Email OTP Verification</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                                            <IonIcon name="mail-open" />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            className="w-full bg-[#0d1421] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white font-mono tracking-widest focus:outline-none focus:border-blue-500/50 transition-all"
                                            placeholder="Enter 4-6 digit code"
                                            required
                                        />
                                    </div>
                                    <p className="text-[10px] text-emerald-500 mt-2 italic text-center font-bold">✨ Dev Mode: Verification code has been auto-filled.</p>
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setAuthStep(1)}
                                        className="h-14 px-6 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                                    >
                                        Back
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                    >
                                        {loading ? 'Verifying...' : 'Verify & Access'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Balance Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-3xl p-6 relative overflow-hidden">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                                        <IonIcon name="wallet" className="text-xl" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Wallet Balance</p>
                                </div>
                                <h3 className="text-3xl font-black text-white">R {userBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
                                <p className="text-xs text-blue-400 mt-2 font-medium">Your Personal Wallet Funds</p>
                            </div>

                            <div className="bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                        <IonIcon name="business" className="text-xl" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Main Googer Balance</p>
                                </div>
                                <h3 className="text-3xl font-black text-white">R {googerBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
                                <p className="text-xs text-emerald-400 mt-2 font-medium">System Total Holding</p>
                            </div>
                        </div>

                        {/* Transfer Section */}
                        <div className="bg-[#162033] border border-gray-800 rounded-3xl p-8 shadow-2xl">
                            <div className="text-center mb-8">
                                <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center text-white mx-auto mb-4 border border-white/10">
                                    <IonIcon name="swap-vertical" className="text-2xl" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Transfer Funds</h3>
                                <p className="text-sm text-gray-500 mt-1">Move funds securely from your Wallet to the Main Googer Balance</p>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Amount to Transfer</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R</div>
                                        <input 
                                            type="number" 
                                            value={transferAmount}
                                            onChange={(e) => setTransferAmount(e.target.value)}
                                            className="w-full bg-[#0d1421] border border-gray-700 rounded-2xl py-4 pl-10 pr-4 text-white text-lg font-bold tracking-wider focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                                            placeholder="0.00"
                                            min="0.01"
                                            step="0.01"
                                        />
                                        <button 
                                            onClick={() => setTransferAmount(userBalance.toString())}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            Max
                                        </button>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleTransfer}
                                    disabled={isTransferring || !transferAmount || Number(transferAmount) <= 0}
                                    className="w-full h-14 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                                >
                                    {isTransferring ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Processing Transfer...
                                        </>
                                    ) : (
                                        <>
                                            <IonIcon name="send" />
                                            Confirm Transfer to Main
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
