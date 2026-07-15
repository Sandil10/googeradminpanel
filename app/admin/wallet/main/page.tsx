"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import IonIcon from '@/components/IonIcon';
import { authService } from '@/services/authService';
import { walletService } from '@/services/walletService';
import { adminService } from '@/services/adminService';

// ─── Countries ────────────────────────────────────────────────────────────────
const COUNTRIES = [
    { code: 'LK', dial: '+94', name: 'Sri Lanka' },
    { code: 'IN', dial: '+91', name: 'India' },
    { code: 'US', dial: '+1', name: 'United States' },
    { code: 'GB', dial: '+44', name: 'United Kingdom' },
    { code: 'AU', dial: '+61', name: 'Australia' },
    { code: 'CA', dial: '+1', name: 'Canada' },
    { code: 'AE', dial: '+971', name: 'UAE' },
    { code: 'SA', dial: '+966', name: 'Saudi Arabia' },
    { code: 'QA', dial: '+974', name: 'Qatar' },
    { code: 'KW', dial: '+965', name: 'Kuwait' },
    { code: 'BH', dial: '+973', name: 'Bahrain' },
    { code: 'OM', dial: '+968', name: 'Oman' },
    { code: 'SG', dial: '+65', name: 'Singapore' },
    { code: 'MY', dial: '+60', name: 'Malaysia' },
    { code: 'PK', dial: '+92', name: 'Pakistan' },
    { code: 'BD', dial: '+880', name: 'Bangladesh' },
    { code: 'NP', dial: '+977', name: 'Nepal' },
    { code: 'PH', dial: '+63', name: 'Philippines' },
    { code: 'ID', dial: '+62', name: 'Indonesia' },
    { code: 'TH', dial: '+66', name: 'Thailand' },
    { code: 'JP', dial: '+81', name: 'Japan' },
    { code: 'KR', dial: '+82', name: 'South Korea' },
    { code: 'DE', dial: '+49', name: 'Germany' },
    { code: 'FR', dial: '+33', name: 'France' },
    { code: 'ZA', dial: '+27', name: 'South Africa' },
    { code: 'NG', dial: '+234', name: 'Nigeria' },
    { code: 'BR', dial: '+55', name: 'Brazil' },
];
const flagUrl = (c: string) => `https://flagsapi.com/${c}/flat/24.png`;
const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};
function numberToWords(n: number): string {
    if (!n || isNaN(n) || n <= 0) return '';
    const o = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const t = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const c = (x: number): string => x === 0 ? '' : x < 20 ? o[x] + ' ' : x < 100 ? t[Math.floor(x/10)] + (x%10 ? ' '+o[x%10] : '') + ' ' : o[Math.floor(x/100)] + ' Hundred ' + c(x%100);
    let v = Math.floor(n), r = '';
    if (v >= 1e9) { r += c(Math.floor(v/1e9)) + 'Billion '; v %= 1e9; }
    if (v >= 1e6) { r += c(Math.floor(v/1e6)) + 'Million '; v %= 1e6; }
    if (v >= 1e3) { r += c(Math.floor(v/1e3)) + 'Thousand '; v %= 1e3; }
    return (r + c(v)).trim();
}

// ─── Inline OTP block (reusable within modals) ───────────────────────────────
type OtpBlockProps = {
    accentClass: string;
    borderClass: string;
    bgClass: string;
    onVerified: () => void;
    setOuterError: (e: string) => void;
};
function EmailOtpBlock({ accentClass, borderClass, bgClass, onVerified, setOuterError }: OtpBlockProps) {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [code, setCode] = useState('');
    const [verified, setVerified] = useState(false);
    const [debug, setDebug] = useState('');
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (!email) { setOuterError('Enter your email address'); return; }
        setOuterError(''); setSending(true);
        await new Promise(r => setTimeout(r, 600));
        const d = String(Math.floor(100000 + Math.random() * 900000));
        setDebug(d); setSent(true); setCode(''); setSending(false);
    };
    const verify = () => {
        if (code.length < 4) { setOuterError('Enter the OTP sent to your email'); return; }
        if (debug && code !== debug) { setOuterError('Incorrect email OTP'); return; }
        setOuterError(''); setVerified(true); onVerified();
    };

    return (
        <div className={`rounded-2xl border p-4 space-y-3 ${verified ? `${borderClass} ${bgClass} opacity-60` : 'border-white/10 bg-white/[0.02]'}`}>
            <div className="flex items-center gap-2">
                <IonIcon name="mail-outline" className="text-sm text-white/40" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Email OTP</span>
                {verified && <span className={`ml-auto text-[8px] font-black uppercase tracking-widest ${accentClass}`}>Verified</span>}
            </div>
            {!verified && (
                <>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <IonIcon name="mail-outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-white/25" />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com"
                                className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-8 pr-3 text-[10px] text-white placeholder-white/20 outline-none" />
                        </div>
                        <button onClick={send} disabled={sending || sent}
                            className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/60 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed">
                            {sending ? '...' : sent ? 'Sent ✓' : 'Send'}
                        </button>
                    </div>
                    {sent && debug && (
                        <div className="flex items-center gap-2 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.07] px-3 py-2">
                            <IonIcon name="flask-outline" className="text-sm text-amber-400 shrink-0" />
                            <span className="text-[9px] text-amber-400/70 font-bold">Debug OTP:</span>
                            <span className="font-mono text-[12px] font-black tracking-[0.25em] text-amber-300">{debug}</span>
                        </div>
                    )}
                    {sent && (
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <IonIcon name="keypad-outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-white/25" />
                                <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Enter code" maxLength={6}
                                    className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-8 pr-3 font-mono text-[11px] tracking-[0.3em] text-white placeholder-white/20 outline-none" />
                            </div>
                            <button onClick={verify} disabled={code.length < 4}
                                className={`shrink-0 rounded-xl border ${borderClass} ${bgClass} px-3 py-2 text-[8px] font-black uppercase tracking-widest ${accentClass} hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed`}>
                                Verify
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function PhoneOtpBlock({ accentClass, borderClass, bgClass, onVerified, setOuterError }: OtpBlockProps) {
    const [country, setCountry] = useState(COUNTRIES[0]);
    const [search, setSearch] = useState('');
    const [showDrop, setShowDrop] = useState(false);
    const [phone, setPhone] = useState('');
    const [sent, setSent] = useState(false);
    const [code, setCode] = useState('');
    const [verified, setVerified] = useState(false);
    const [debug, setDebug] = useState('');
    const [sending, setSending] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false); };
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);

    const filtered = COUNTRIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search));

    const send = async () => {
        if (!phone) { setOuterError('Enter your phone number'); return; }
        setOuterError(''); setSending(true);
        const full = country.dial.replace('+','') + phone.replace(/\D/g,'');
        try {
            const res = await fetch('/api/admin/send-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone: full }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
            if (data.debug_otp) setDebug(data.debug_otp);
            setSent(true); setCode('');
        } catch (err: any) { setOuterError(err.message); }
        finally { setSending(false); }
    };

    const verify = async () => {
        if (code.length < 4) { setOuterError('Enter the OTP sent to your phone'); return; }
        setOuterError('');
        const full = country.dial.replace('+','') + phone.replace(/\D/g,'');
        try {
            const res = await fetch('/api/admin/verify-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone: full, otp: code }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Verification failed');
            setVerified(true); onVerified();
        } catch (err: any) { setOuterError(err.message); }
    };

    return (
        <div className={`rounded-2xl border p-4 space-y-3 ${verified ? `${borderClass} ${bgClass} opacity-60` : 'border-white/10 bg-white/[0.02]'}`}>
            <div className="flex items-center gap-2">
                <IonIcon name="phone-portrait-outline" className="text-sm text-white/40" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Phone OTP</span>
                {verified && <span className={`ml-auto text-[8px] font-black uppercase tracking-widest ${accentClass}`}>Verified</span>}
            </div>
            {!verified && (
                <>
                    <div className="flex gap-2">
                        <div className="relative" ref={dropRef}>
                            <button onClick={() => { setShowDrop(v => !v); setSearch(''); }}
                                className="flex h-full items-center gap-1 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 whitespace-nowrap hover:border-white/20">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={flagUrl(country.code)} alt="" width={16} height={12} />
                                <span className="text-[9px] font-bold text-white/70">{country.dial}</span>
                                <IonIcon name="chevron-down-outline" className="text-[8px] text-white/30" />
                            </button>
                            {showDrop && (
                                <div className="absolute top-full left-0 mt-1.5 w-52 rounded-2xl border border-white/10 bg-[#09090b] shadow-2xl z-50 overflow-hidden">
                                    <div className="p-2 border-b border-white/[0.06]">
                                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." autoFocus
                                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-1.5 px-3 text-[10px] text-white placeholder-white/25 outline-none" />
                                    </div>
                                    <div className="max-h-40 overflow-y-auto">
                                        {filtered.map(c => (
                                            <button key={c.code} onClick={() => { setCountry(c); setShowDrop(false); }}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.05] ${country.code === c.code ? 'bg-white/[0.04]' : ''}`}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={flagUrl(c.code)} alt="" width={16} height={12} />
                                                <span className="flex-1 text-[9px] font-bold text-white truncate">{c.name}</span>
                                                <span className="text-[8px] text-white/35">{c.dial}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d\s\-()]/g,''))} placeholder="71 234 5678"
                            className="flex-1 min-w-0 rounded-xl border border-white/10 bg-black/30 py-2 px-3 text-[10px] text-white placeholder-white/20 outline-none" />
                        <button onClick={send} disabled={sending || !phone}
                            className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/60 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                            {sending ? '...' : sent ? 'Resend' : 'Send'}
                        </button>
                    </div>
                    {sent && <p className="text-[9px] font-bold text-emerald-400/60">OTP sent to {country.dial} {phone}</p>}
                    {sent && debug && (
                        <div className="flex items-center gap-2 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.07] px-3 py-2">
                            <IonIcon name="flask-outline" className="text-sm text-amber-400 shrink-0" />
                            <span className="text-[9px] text-amber-400/70 font-bold">Debug OTP:</span>
                            <span className="font-mono text-[12px] font-black tracking-[0.25em] text-amber-300">{debug}</span>
                        </div>
                    )}
                    {sent && (
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <IonIcon name="keypad-outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-white/25" />
                                <input type="text" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Enter code" maxLength={6}
                                    className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-8 pr-3 font-mono text-[11px] tracking-[0.3em] text-white placeholder-white/20 outline-none" />
                            </div>
                            <button onClick={verify} disabled={code.length < 4}
                                className={`shrink-0 rounded-xl border ${borderClass} ${bgClass} px-3 py-2 text-[8px] font-black uppercase tracking-widest ${accentClass} hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed`}>
                                Verify
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Add Capital Modal ────────────────────────────────────────────────────────
type AddCapModalProps = { amount: number; onConfirm: () => Promise<void>; onClose: () => void; submitting: boolean; error: string; setError: (e: string) => void; };
function AddCapitalModal({ amount, onConfirm, onClose, submitting, error, setError }: AddCapModalProps) {
    const [emailOk, setEmailOk] = useState(false);
    const [phoneOk, setPhoneOk] = useState(false);
    const both = emailOk && phoneOk;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden">
                <div className="p-6 pb-4 border-b border-emerald-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                                <IonIcon name="shield-checkmark-outline" className="text-base" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Security Verification</p>
                                <h3 className="text-sm font-black uppercase tracking-tight text-white">Add R {amount.toFixed(2)}</h3>
                            </div>
                        </div>
                        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white">
                            <IonIcon name="close-outline" className="text-sm" />
                        </button>
                    </div>
                    <p className="mt-3 text-[9px] text-white/30 leading-relaxed">Both email and phone verification are required to add capital funds.</p>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {error && (
                        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                            <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
                            <p className="text-[10px] font-bold text-rose-300">{error}</p>
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 flex-1 rounded-2xl border px-3 py-2 ${emailOk ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
                            <IonIcon name={emailOk ? 'checkmark-circle' : 'mail-outline'} className={`text-sm ${emailOk ? 'text-emerald-400' : 'text-white/30'}`} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${emailOk ? 'text-emerald-400' : 'text-white/30'}`}>Email</span>
                        </div>
                        <div className="h-px w-4 bg-white/10" />
                        <div className={`flex items-center gap-2 flex-1 rounded-2xl border px-3 py-2 ${phoneOk ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
                            <IonIcon name={phoneOk ? 'checkmark-circle' : 'phone-portrait-outline'} className={`text-sm ${phoneOk ? 'text-emerald-400' : 'text-white/30'}`} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${phoneOk ? 'text-emerald-400' : 'text-white/30'}`}>Phone</span>
                        </div>
                    </div>
                    <EmailOtpBlock accentClass="text-emerald-400" borderClass="border-emerald-500/30" bgClass="bg-emerald-500/10" onVerified={() => setEmailOk(true)} setOuterError={setError} />
                    <PhoneOtpBlock  accentClass="text-emerald-400" borderClass="border-emerald-500/30" bgClass="bg-emerald-500/10" onVerified={() => setPhoneOk(true)}  setOuterError={setError} />
                    <button onClick={onConfirm} disabled={!both || submitting}
                        className="w-full rounded-2xl bg-emerald-500 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">
                        {submitting ? <span className="flex items-center justify-center gap-2"><span className="h-3.5 w-3.5 animate-spin rounded-full border border-black/20 border-t-black" />Adding...</span>
                            : !both ? 'Verify Both OTPs to Continue' : `Confirm — Add R ${amount.toFixed(2)}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Transfer to Googer Modal ─────────────────────────────────────────────────
type TransferModalProps = { userBalance: number; onSuccess: (newBal: number) => void; onClose: () => void; };
type TxHistRow = { id: number; transfer_amount: string; note: string; created_at: string; sender_name: string; username: string; };

function TransferModal({ userBalance, onSuccess, onClose }: TransferModalProps) {
    const [amount, setAmount]           = useState('');
    const [error, setError]             = useState('');
    const [emailOk, setEmailOk]         = useState(false);
    const [phoneOk, setPhoneOk]         = useState(false);
    const [submitting, setSubmitting]   = useState(false);
    const [success, setSuccess]         = useState('');
    const [showHist, setShowHist]       = useState(false);
    const [hist, setHist]               = useState<TxHistRow[]>([]);
    const [histLoading, setHistLoading] = useState(false);

    const both = emailOk && phoneOk;
    const words = numberToWords(Number(amount));

    const loadHist = async () => {
        setHistLoading(true);
        try { setHist(await adminService.fetchCapitalTransferHistory()); }
        catch { /* silent */ } finally { setHistLoading(false); }
    };

    const toggleHist = () => { if (!showHist) loadHist(); setShowHist(v => !v); };

    const confirm = async () => {
        if (!amount || Number(amount) <= 0) { setError('Enter a valid amount'); return; }
        if (Number(amount) > userBalance) { setError('Insufficient balance'); return; }
        setError(''); setSubmitting(true);
        try {
            await walletService.transferToGooger(Number(amount), 'Admin Capital Transfer to Main Googer Balance');
            setSuccess(`R ${Number(amount).toFixed(2)} transferred successfully.`);
            onSuccess(userBalance - Number(amount));
            if (showHist) loadHist();
        } catch (err: any) { setError(err.message || 'Transfer failed'); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden">
                <div className="p-6 pb-4 border-b border-blue-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                                <IonIcon name="swap-vertical-outline" className="text-base" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Transfer to Main Googer</p>
                                <h3 className="text-sm font-black uppercase tracking-tight text-white">Move Wallet Funds</h3>
                            </div>
                        </div>
                        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white">
                            <IonIcon name="close-outline" className="text-sm" />
                        </button>
                    </div>
                    <p className="mt-3 text-[9px] text-white/30 leading-relaxed">Move funds from your Wallet to the Main Googer Balance. Both OTPs required.</p>
                </div>

                <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
                    {error && (
                        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                            <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
                            <p className="text-[10px] font-bold text-rose-300">{error}</p>
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                            <IonIcon name="checkmark-circle-outline" className="shrink-0 text-sm text-emerald-400" />
                            <p className="text-[10px] font-bold text-emerald-300">{success}</p>
                        </div>
                    )}

                    {/* Amount */}
                    <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Amount to Transfer</span>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-black text-white/35">R</span>
                            <input type="number" value={amount} onChange={e => { setAmount(e.target.value); setSuccess(''); }} placeholder="0.00" min="0.01" step="0.01"
                                className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-8 pr-16 font-mono text-sm font-bold text-white placeholder-white/20 outline-none transition focus:border-blue-500/30" />
                            <button onClick={() => setAmount(userBalance.toString())}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/10 hover:text-white">
                                Max
                            </button>
                        </div>
                        {words && <p className="text-[9px] font-bold text-blue-400/60 px-1">R {words}</p>}
                        <p className="text-[9px] text-white/25">Available: R {userBalance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                    </div>

                    {/* OTP progress chips */}
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 flex-1 rounded-2xl border px-3 py-2 ${emailOk ? 'border-blue-500/20 bg-blue-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
                            <IonIcon name={emailOk ? 'checkmark-circle' : 'mail-outline'} className={`text-sm ${emailOk ? 'text-blue-400' : 'text-white/30'}`} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${emailOk ? 'text-blue-400' : 'text-white/30'}`}>Email</span>
                        </div>
                        <div className="h-px w-4 bg-white/10" />
                        <div className={`flex items-center gap-2 flex-1 rounded-2xl border px-3 py-2 ${phoneOk ? 'border-blue-500/20 bg-blue-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
                            <IonIcon name={phoneOk ? 'checkmark-circle' : 'phone-portrait-outline'} className={`text-sm ${phoneOk ? 'text-blue-400' : 'text-white/30'}`} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${phoneOk ? 'text-blue-400' : 'text-white/30'}`}>Phone</span>
                        </div>
                    </div>

                    <EmailOtpBlock accentClass="text-blue-400" borderClass="border-blue-500/30" bgClass="bg-blue-500/10" onVerified={() => setEmailOk(true)} setOuterError={setError} />
                    <PhoneOtpBlock  accentClass="text-blue-400" borderClass="border-blue-500/30" bgClass="bg-blue-500/10" onVerified={() => setPhoneOk(true)}  setOuterError={setError} />

                    {/* Action buttons */}
                    <div className="flex gap-3">
                        <button onClick={confirm} disabled={!both || submitting || !amount || Number(amount) <= 0}
                            className="flex-1 rounded-2xl bg-blue-500 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed">
                            {submitting ? <span className="flex items-center justify-center gap-2"><span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/20 border-t-white" />Processing...</span>
                                : !both ? 'Verify Both OTPs' : 'Transfer Amount'}
                        </button>
                        <button onClick={toggleHist}
                            className={`rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest transition ${showHist ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08]'}`}>
                            <span className="flex items-center gap-1.5"><IonIcon name="time-outline" className="text-sm" />History</span>
                        </button>
                    </div>

                    {/* History inline */}
                    {showHist && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                                <IonIcon name="time-outline" className="text-sm text-white/40" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Transfer History</span>
                                <span className="ml-auto text-[8px] text-white/20">Cannot be removed</span>
                            </div>
                            {histLoading ? (
                                <p className="p-6 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</p>
                            ) : hist.length === 0 ? (
                                <p className="p-6 text-center text-[10px] font-black uppercase tracking-widest text-white/25">No transfers yet</p>
                            ) : (
                                <div className="divide-y divide-white/[0.04]">
                                    {hist.map((r, i) => (
                                        <div key={i} className="flex items-center justify-between px-4 py-3">
                                            <div>
                                                <p className="text-[10px] font-bold text-white">{r.sender_name || 'Unknown'}</p>
                                                <p className="text-[8px] text-white/30 mt-0.5 truncate max-w-[160px]">{r.note || '—'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] font-black text-blue-400">R {parseFloat(r.transfer_amount||'0').toFixed(2)}</p>
                                                <p className="text-[8px] text-white/25 mt-0.5">{timeAgo(r.created_at)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Sub-view types ───────────────────────────────────────────────────────────
type CoinRow = { ad_id: string; ad_type: string; commission: string; reward_amount: string; advertiser_charge: string; created_at: string; advertiser_name: string; collector_name: string; advertiser_id: string; collector_user_id: string; };
type PromoteRow = { id: number; amount: string; commission: string; note: string; created_at: string; user_name: string; user_readable_id: string; username: string; };
type HistRow = { id: number; transfer_amount: string; note: string; created_at: string; sender_name: string; username: string; };
type WalletView = 'main' | 'commissions' | 'ads-profit' | 'capital-history' | 'user-transfer';
type UserRow = { id: number; full_name: string; username: string; user_id: string; wallet_balance: string; user_type: string; profile_picture?: string; };
type UserTxRow = { id: number; amount: string; note: string; created_at: string; sender_name: string; sender_username: string; sender_type: string; receiver_name: string; receiver_username: string; receiver_readable_id: string; receiver_type: string; };

// ─── Main component ───────────────────────────────────────────────────────────
export default function WalletSystemTopup() {
    const router = useRouter();

    // Auth
    const [isVerified, setIsVerified] = useState(false);
    const [authStep, setAuthStep]     = useState(1);
    const [username, setUsername]     = useState('');
    const [password, setPassword]     = useState('');
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState('');
    const [otpMethod, setOtpMethod]   = useState<'email'|'phone'|null>(null);
    const [emailInput, setEmailInput] = useState('');
    const [emailOtp, setEmailOtp]     = useState('');
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [selCountry, setSelCountry] = useState(COUNTRIES[0]);
    const [cSearch, setCSearch]       = useState('');
    const [showCDrop, setShowCDrop]   = useState(false);
    const [phoneLocal, setPhoneLocal] = useState('');
    const [phoneOtp, setPhoneOtp]     = useState('');
    const [phoneOtpSent, setPhoneOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [phoneDbg, setPhoneDbg]     = useState('');
    const cDropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (cDropRef.current && !cDropRef.current.contains(e.target as Node)) setShowCDrop(false); };
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);

    const filtC = COUNTRIES.filter(c => c.name.toLowerCase().includes(cSearch.toLowerCase()) || c.dial.includes(cSearch));

    // Wallet state
    const [userBalance, setUserBalance]   = useState(0);
    const [googerBalance, setGoogerBalance] = useState(0);
    const [googerExpanded, setGoogerExpanded] = useState(false);

    // View state
    const [walletView, setWalletView] = useState<WalletView>('main');

    // Sub-view data
    const [coinRows, setCoinRows]     = useState<CoinRow[]>([]);
    const [coinLoading, setCoinLoading] = useState(false);
    const [coinTotal, setCoinTotal]   = useState(0);
    const [proRows, setProRows]       = useState<PromoteRow[]>([]);
    const [proLoading, setProLoading] = useState(false);
    const [proTotal, setProTotal]     = useState(0);
    const [histRows, setHistRows]         = useState<HistRow[]>([]);
    const [histLoading, setHistLoading]   = useState(false);
    type CapAddRow = { id: number; amount: string; note: string; created_at: string; sender_name: string; username: string; };
    const [capAddRows, setCapAddRows]     = useState<CapAddRow[]>([]);
    const [capAddLoading, setCapAddLoading] = useState(false);

    // User-transfer sub-view
    const [utTab, setUtTab]                   = useState<'transfer'|'history'>('transfer');
    const [utUsers, setUtUsers]               = useState<UserRow[]>([]);
    const [utUsersLoading, setUtUsersLoading] = useState(false);
    const [utSearch, setUtSearch]             = useState('');
    const [utSelected, setUtSelected]         = useState<UserRow | null>(null);
    const [utAmount, setUtAmount]             = useState('');
    const [utNote, setUtNote]                 = useState('');
    const [utSubmitting, setUtSubmitting]     = useState(false);
    const [utError, setUtError]               = useState('');
    const [utSuccess, setUtSuccess]           = useState('');
    const [utHistory, setUtHistory]           = useState<UserTxRow[]>([]);
    const [utPasswordStep, setUtPasswordStep] = useState(false);
    const [utPassword, setUtPassword]         = useState('');
    const [utHistLoading, setUtHistLoading]   = useState(false);
    const [showUtModal, setShowUtModal]       = useState(false);
    const [utModalTab, setUtModalTab]         = useState<'transfer'|'history'>('transfer');

    // Add Capital
    const [capitalAmount, setCapitalAmount] = useState('');
    const [showCapModal, setShowCapModal]   = useState(false);
    const [capError, setCapError]           = useState('');
    const [capSuccess, setCapSuccess]       = useState('');
    const [capSubmitting, setCapSubmitting] = useState(false);

    // Transfer popup
    const [showTransferModal, setShowTransferModal] = useState(false);


    // Fetch sub-view data
    useEffect(() => {
        if (walletView === 'commissions' && coinRows.length === 0 && !coinLoading) {
            setCoinLoading(true);
            adminService.fetchCoinCollectDetail().then((d: CoinRow[]) => {
                setCoinRows(d);
                setCoinTotal(d.reduce((s, r) => s + parseFloat(r.commission||'0'), 0));
            }).catch(console.error).finally(() => setCoinLoading(false));
        }
        if (walletView === 'ads-profit' && proRows.length === 0 && !proLoading) {
            setProLoading(true);
            adminService.fetchProfilePromoteDetail().then((d: PromoteRow[]) => {
                setProRows(d);
                setProTotal(d.reduce((s, r) => s + parseFloat(r.commission||'0'), 0));
            }).catch(console.error).finally(() => setProLoading(false));
        }
        if (walletView === 'capital-history') {
            if (histRows.length === 0 && !histLoading) {
                setHistLoading(true);
                adminService.fetchCapitalTransferHistory().then((d: HistRow[]) => setHistRows(d))
                    .catch(console.error).finally(() => setHistLoading(false));
            }
            if (capAddRows.length === 0 && !capAddLoading) {
                setCapAddLoading(true);
                adminService.fetchCapitalAddHistory().then((d: CapAddRow[]) => setCapAddRows(d))
                    .catch(console.error).finally(() => setCapAddLoading(false));
            }
        }
        if (walletView === 'user-transfer' && utUsers.length === 0 && !utUsersLoading) {
            setUtUsersLoading(true);
            adminService.fetchAllUsersList().then((d: UserRow[]) => setUtUsers(d))
                .catch(console.error).finally(() => setUtUsersLoading(false));
        }
    }, [walletView]);

    const loadUtHistory = () => {
        setUtHistLoading(true);
        adminService.fetchUserTransferHistory().then((d: UserTxRow[]) => setUtHistory(d))
            .catch(console.error).finally(() => setUtHistLoading(false));
    };

    const openUtModal = (tab: 'transfer' | 'history' = 'transfer') => {
        setUtModalTab(tab);
        setUtError(''); setUtSuccess('');
        if (utUsers.length === 0 && !utUsersLoading) {
            setUtUsersLoading(true);
            adminService.fetchAllUsersList().then((d: UserRow[]) => setUtUsers(d))
                .catch(console.error).finally(() => setUtUsersLoading(false));
        }
        if (tab === 'history') loadUtHistory();
        setShowUtModal(true);
    };

    const handleUtTransfer = async () => {
        if (!utSelected) { setUtError('Select a recipient'); return; }
        if (!utAmount || Number(utAmount) <= 0) { setUtError('Enter a valid amount'); return; }
        if (Number(utAmount) > googerBalance) { setUtError('Insufficient Googer Balance'); return; }
        // Show password step first
        if (!utPasswordStep) { setUtPasswordStep(true); setUtPassword(''); setUtError(''); return; }
        // Verify password then transfer
        if (!utPassword) { setUtError('Enter your password to confirm'); return; }
        setUtError(''); setUtSubmitting(true);
        try {
            await authService.verifyPassword(utPassword);
            await adminService.transferGoogerToAdmin(utSelected.id, Number(utAmount));
            setUtSuccess(`R ${Number(utAmount).toFixed(2)} transferred to ${utSelected.full_name || utSelected.username}.`);
            setGoogerBalance(prev => prev - Number(utAmount));
            void fetchBalances();
            setUtAmount(''); setUtNote(''); setUtSelected(null);
            setUtPasswordStep(false); setUtPassword('');
            if (utTab === 'history') loadUtHistory();
        } catch (err: any) { setUtError(err.message || 'Transfer failed'); }
        finally { setUtSubmitting(false); }
    };

    const fetchBalances = async () => {
        try {
            const [p, s] = await Promise.all([
                authService.getProfile(),
                adminService.fetchStats(),
            ]);
            setUserBalance(parseFloat(p.wallet_balance) || 0);
            setGoogerBalance(Number(s.googerBalance || 0));
        } catch (e) { console.error(e); }
    };

    // Auth handlers
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setLoading(true);
        try { await authService.login({ email: username, password }); setAuthStep(2); setOtpMethod(null); }
        catch (err: any) { setError(err.message || 'Invalid credentials'); }
        finally { setLoading(false); }
    };
    const handleTestAccess = () => { setError(''); setIsVerified(true); fetchBalances(); };
    const handleSendEmailOtp = async () => {
        if (!emailInput) { setError('Enter your email address'); return; }
        setError(''); setSendingOtp(true);
        await new Promise(r => setTimeout(r, 800));
        setEmailOtpSent(true); setEmailOtp(''); setSendingOtp(false);
    };
    const handleSendPhoneOtp = async () => {
        if (!phoneLocal) { setError('Enter your phone number'); return; }
        setError(''); setSendingOtp(true);
        const full = selCountry.dial.replace('+','') + phoneLocal.replace(/\D/g,'');
        try {
            const res = await fetch('/api/admin/send-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone: full }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
            if (data.debug_otp) setPhoneDbg(data.debug_otp);
            setPhoneOtpSent(true); setPhoneOtp('');
        } catch (err: any) { setError(err.message); }
        finally { setSendingOtp(false); }
    };
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (otpMethod === 'phone') {
                const full = selCountry.dial.replace('+','') + phoneLocal.replace(/\D/g,'');
                const res = await fetch('/api/admin/verify-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone: full, otp: phoneOtp }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Verification failed');
            } else {
                if (!emailOtp || emailOtp.length < 4) throw new Error('Enter the OTP sent to your email');
            }
            setIsVerified(true); fetchBalances();
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    };

    const handleConfirmCapital = async () => {
        setCapSubmitting(true);
        try {
            const result = await adminService.addWalletCapital(Number(capitalAmount));
            setShowCapModal(false);
            setCapSuccess(`R ${Number(capitalAmount).toFixed(2)} added to your wallet.`);
            setCapitalAmount('');
            setUserBalance(result.newBalance);
            void fetchBalances();
        } catch (err: any) { setCapError(err.message || 'Failed to add capital'); }
        finally { setCapSubmitting(false); }
    };

    const capWords = numberToWords(Number(capitalAmount));

    const SubViewHeader = ({ label, color }: { label: string; color: string }) => (
        <div className="flex items-center gap-3">
            <button onClick={() => setWalletView('main')}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white">
                <IonIcon name="chevron-back-outline" className="text-base" />
            </button>
            <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Wallet & Top-Up System</p>
                <h1 className={`text-base font-black uppercase tracking-tight ${color}`}>{label}</h1>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center gap-3">
                {walletView !== 'main' && (
                    <button onClick={() => setWalletView('main')}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white">
                        <IonIcon name="chevron-back-outline" className="text-base" />
                    </button>
                )}
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Admin</p>
                    <h1 className="text-base font-black uppercase tracking-tight text-white">Wallet & Top-Up System</h1>
                </div>
            </div>

            {/* ── Auth ── */}
            {!isVerified ? (
                <div className="mx-auto w-full max-w-md">
                    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 space-y-5">
                        <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/50">
                                <IonIcon name={authStep === 1 ? 'lock-closed-outline' : 'shield-checkmark-outline'} className="text-base" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">{authStep === 1 ? 'Step 1 of 2' : 'Step 2 of 2'}</p>
                                <h2 className="text-sm font-black uppercase tracking-tight text-white">{authStep === 1 ? 'Admin Authentication' : '2-Step Verification'}</h2>
                            </div>
                        </div>
                        <div className="flex gap-1.5">
                            <div className="h-1 w-8 rounded-full bg-white" />
                            <div className={`h-1 w-8 rounded-full transition-colors ${authStep === 2 ? 'bg-white' : 'bg-white/15'}`} />
                        </div>
                        {error && (
                            <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                                <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
                                <p className="text-[10px] font-bold text-rose-300">{error}</p>
                            </div>
                        )}

                        {authStep === 1 && (
                            <form onSubmit={handleLogin} className="space-y-4">
                                <label className="block space-y-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Username / Email</span>
                                    <div className="relative">
                                        <IonIcon name="person-outline" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-white/25" />
                                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username or email" required
                                            className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-4 text-[11px] text-white placeholder-white/20 outline-none transition focus:border-white/25" />
                                    </div>
                                </label>
                                <label className="block space-y-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Password</span>
                                    <div className="relative">
                                        <IonIcon name="key-outline" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-white/25" />
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required
                                            className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-4 text-[11px] text-white placeholder-white/20 outline-none transition focus:border-white/25" />
                                    </div>
                                </label>
                                <button type="submit" disabled={loading}
                                    className="w-full rounded-2xl bg-white py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {loading ? 'Authenticating...' : 'Sign In & Continue'}
                                </button>
                                <div className="pt-1">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="flex-1 h-px bg-white/[0.06]" />
                                        <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Testing</span>
                                        <div className="flex-1 h-px bg-white/[0.06]" />
                                    </div>
                                    <button type="button" onClick={handleTestAccess}
                                        className="w-full rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/[0.05] py-2.5 text-[10px] font-black uppercase tracking-widest text-amber-400/70 transition hover:bg-amber-500/[0.10] hover:text-amber-400">
                                        <span className="flex items-center justify-center gap-2"><IonIcon name="flask-outline" className="text-sm" />Test Access</span>
                                    </button>
                                    <p className="mt-1.5 text-center text-[8px] text-white/15">Bypass authentication for testing purposes</p>
                                </div>
                            </form>
                        )}

                        {authStep === 2 && otpMethod === null && (
                            <div className="space-y-3">
                                <p className="text-[10px] text-white/35 font-bold">Choose how to receive your verification code</p>
                                {[{ m: 'email' as const, icon: 'mail-outline', title: 'Email Verification', sub: 'Receive OTP to your email address' },
                                  { m: 'phone' as const, icon: 'phone-portrait-outline', title: 'Phone OTP', sub: 'Receive SMS code to your phone' }].map(opt => (
                                    <button key={opt.m} onClick={() => { setOtpMethod(opt.m); setError(''); }}
                                        className="w-full flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left hover:bg-white/[0.07] hover:border-white/20 group transition">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/50 group-hover:text-white transition">
                                            <IonIcon name={opt.icon} className="text-base" />
                                        </div>
                                        <div><p className="text-[11px] font-black uppercase tracking-wide text-white">{opt.title}</p><p className="text-[9px] text-white/35 mt-0.5">{opt.sub}</p></div>
                                        <IonIcon name="chevron-forward-outline" className="ml-auto text-white/25 text-sm shrink-0" />
                                    </button>
                                ))}
                                <button onClick={() => setAuthStep(1)} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 text-[10px] font-black uppercase tracking-widest text-white/50 hover:bg-white/[0.08]">Back</button>
                            </div>
                        )}

                        {authStep === 2 && otpMethod === 'email' && (
                            <form onSubmit={handleVerify} className="space-y-4">
                                <label className="block space-y-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Email Address</span>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <IonIcon name="mail-outline" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-white/25" />
                                            <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="admin@example.com"
                                                className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-4 text-[11px] text-white placeholder-white/20 outline-none" />
                                        </div>
                                        <button type="button" onClick={handleSendEmailOtp} disabled={sendingOtp || emailOtpSent}
                                            className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/60 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed">
                                            {sendingOtp ? '...' : emailOtpSent ? 'Sent ✓' : 'Send'}
                                        </button>
                                    </div>
                                </label>
                                {emailOtpSent && (
                                    <label className="block space-y-1.5">
                                        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Email OTP</span>
                                        <div className="relative">
                                            <IonIcon name="mail-open-outline" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-white/25" />
                                            <input type="text" value={emailOtp} onChange={e => setEmailOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code" maxLength={6}
                                                className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-4 font-mono text-[13px] tracking-[0.35em] text-white placeholder-white/20 outline-none" />
                                        </div>
                                    </label>
                                )}
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setOtpMethod(null); setEmailOtpSent(false); setEmailOtp(''); setError(''); }}
                                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/[0.08]">Back</button>
                                    <button type="submit" disabled={loading || !emailOtpSent}
                                        className="flex-1 rounded-2xl bg-white py-3 text-[10px] font-black uppercase tracking-widest text-black hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed">
                                        {loading ? 'Verifying...' : 'Verify & Access'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {authStep === 2 && otpMethod === 'phone' && (
                            <form onSubmit={handleVerify} className="space-y-4">
                                <div className="space-y-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Phone Number</span>
                                    <div className="flex gap-2">
                                        <div className="relative" ref={cDropRef}>
                                            <button type="button" onClick={() => { setShowCDrop(v => !v); setCSearch(''); }}
                                                className="flex h-full items-center gap-1.5 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 whitespace-nowrap hover:border-white/20">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={flagUrl(selCountry.code)} alt="" width={18} height={13} />
                                                <span className="text-white/70 text-[10px] font-bold">{selCountry.dial}</span>
                                                <IonIcon name="chevron-down-outline" className="text-[9px] text-white/30" />
                                            </button>
                                            {showCDrop && (
                                                <div className="absolute top-full left-0 mt-1.5 w-60 rounded-2xl border border-white/10 bg-[#09090b] shadow-2xl z-50 overflow-hidden">
                                                    <div className="p-2 border-b border-white/[0.06]">
                                                        <input value={cSearch} onChange={e => setCSearch(e.target.value)} placeholder="Search country..." autoFocus
                                                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 px-3 text-[10px] text-white placeholder-white/25 outline-none" />
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto">
                                                        {filtC.map(c => (
                                                            <button key={c.code} type="button" onClick={() => { setSelCountry(c); setShowCDrop(false); }}
                                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.05] ${selCountry.code === c.code ? 'bg-white/[0.04]' : ''}`}>
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={flagUrl(c.code)} alt="" width={20} height={15} />
                                                                <span className="flex-1 text-[10px] font-bold text-white truncate">{c.name}</span>
                                                                <span className="text-[9px] text-white/35">{c.dial}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 flex gap-2">
                                            <input type="tel" value={phoneLocal} onChange={e => setPhoneLocal(e.target.value.replace(/[^\d\s\-()]/g,''))} placeholder="71 234 5678"
                                                className="flex-1 min-w-0 rounded-2xl border border-white/10 bg-black/30 py-2.5 px-3.5 text-[11px] text-white placeholder-white/20 outline-none" />
                                            <button type="button" onClick={handleSendPhoneOtp} disabled={sendingOtp || !phoneLocal}
                                                className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/60 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                                                {sendingOtp ? <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white/20 border-t-white/60 block" /> : phoneOtpSent ? 'Resend' : 'Send OTP'}
                                            </button>
                                        </div>
                                    </div>
                                    {phoneOtpSent && (
                                        <div className="space-y-1.5 mt-1">
                                            <p className="text-[9px] font-bold text-emerald-400/70">OTP sent to {selCountry.dial} {phoneLocal}</p>
                                            {phoneDbg && (
                                                <div className="flex items-center gap-2 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.07] px-3 py-2">
                                                    <IonIcon name="flask-outline" className="text-sm text-amber-400 shrink-0" />
                                                    <span className="text-[9px] text-amber-400/70 font-bold">Debug OTP:</span>
                                                    <span className="font-mono text-[12px] font-black tracking-[0.25em] text-amber-300">{phoneDbg}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {phoneOtpSent && (
                                    <label className="block space-y-1.5">
                                        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Enter OTP</span>
                                        <div className="relative">
                                            <IonIcon name="keypad-outline" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-white/25" />
                                            <input type="text" inputMode="numeric" value={phoneOtp} onChange={e => setPhoneOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code" maxLength={6}
                                                className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-4 font-mono text-[13px] tracking-[0.35em] text-white placeholder-white/20 outline-none" />
                                        </div>
                                    </label>
                                )}
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setOtpMethod(null); setPhoneOtpSent(false); setPhoneOtp(''); setPhoneLocal(''); setPhoneDbg(''); setError(''); }}
                                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/[0.08]">Back</button>
                                    <button type="submit" disabled={loading || !phoneOtpSent || phoneOtp.length < 4}
                                        className="flex-1 rounded-2xl bg-white py-3 text-[10px] font-black uppercase tracking-widest text-black hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed">
                                        {loading ? 'Verifying...' : 'Verify & Access'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

            ) : walletView === 'commissions' ? (
                /* ── Googer Commissions sub-view ── */
                <div className="space-y-6">
                    <SubViewHeader label="Googer Commissions" color="text-emerald-400" />
                    <div className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/[0.06] p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-400/70 mb-1">Total Googer Commission Earned</p>
                            <p className="text-2xl font-black text-white">R {coinTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                            <p className="text-[9px] text-white/30 mt-1">{coinRows.length} collection event{coinRows.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <IonIcon name="logo-bitcoin" className="text-2xl text-emerald-400" />
                        </div>
                    </div>
                    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
                        {coinLoading ? <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</div>
                        : coinRows.length === 0 ? <div className="p-12 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-white/25">No coin collections yet</p></div>
                        : (
                            <div className="w-full overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead><tr className="border-b border-white/[0.06] text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                                        <th className="px-6 py-4">Ad</th><th className="px-6 py-4">Advertiser</th><th className="px-6 py-4">Collector</th>
                                        <th className="px-6 py-4 text-right">Reward Paid</th><th className="px-6 py-4 text-right">Googer Cut</th><th className="px-6 py-4 text-right">Total Charge</th><th className="px-6 py-4 text-right">When</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {coinRows.map((r, i) => (
                                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4"><p className="text-[10px] font-black text-white/80 font-mono">{r.ad_id||'—'}</p><p className="text-[9px] text-white/30 mt-0.5 uppercase tracking-widest">{r.ad_type||'—'}</p></td>
                                                <td className="px-6 py-4"><p className="text-[11px] font-bold text-white">{r.advertiser_name||'Unknown'}</p><p className="text-[9px] font-mono text-white/30 mt-0.5">ID: {r.advertiser_id||'—'}</p></td>
                                                <td className="px-6 py-4"><p className="text-[11px] font-bold text-white">{r.collector_name||'Unknown'}</p><p className="text-[9px] font-mono text-white/30 mt-0.5">ID: {r.collector_user_id||'—'}</p></td>
                                                <td className="px-6 py-4 text-right"><span className="text-[11px] font-black text-white/70">R {parseFloat(r.reward_amount||'0').toFixed(2)}</span></td>
                                                <td className="px-6 py-4 text-right"><span className="text-[11px] font-black text-emerald-400">+R {parseFloat(r.commission||'0').toFixed(2)}</span></td>
                                                <td className="px-6 py-4 text-right"><span className="text-[11px] font-black text-white/50">R {parseFloat(r.advertiser_charge||'0').toFixed(2)}</span></td>
                                                <td className="px-6 py-4 text-right"><p className="text-[10px] font-bold text-white/40">{timeAgo(r.created_at)}</p><p className="text-[9px] text-white/20 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

            ) : walletView === 'ads-profit' ? (
                /* ── Googer Ads Profit sub-view ── */
                <div className="space-y-6">
                    <SubViewHeader label="Googer Ads Profit" color="text-violet-400" />
                    <div className="rounded-[1.75rem] border border-violet-500/20 bg-violet-500/[0.06] p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-400/70 mb-1">Total Googer Income from Profile Ads</p>
                            <p className="text-2xl font-black text-white">R {proTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                            <p className="text-[9px] text-white/30 mt-1">{proRows.length} ad publication{proRows.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                            <IonIcon name="person-circle-outline" className="text-2xl text-violet-400" />
                        </div>
                    </div>
                    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
                        {proLoading ? <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</div>
                        : proRows.length === 0 ? <div className="p-12 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-white/25">No profile promote ads yet</p></div>
                        : (
                            <div className="w-full overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead><tr className="border-b border-white/[0.06] text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                                        <th className="px-6 py-4">User</th><th className="px-6 py-4">Note</th><th className="px-6 py-4 text-right">Ad Amount</th><th className="px-6 py-4 text-right">Googer Income</th><th className="px-6 py-4 text-right">When</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {proRows.map((r, i) => (
                                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4"><p className="text-[11px] font-bold text-white">{r.user_name||'Unknown'}</p><p className="text-[9px] text-white/40 mt-0.5">@{r.username||'—'}</p><p className="text-[9px] font-mono text-white/25 mt-0.5">ID: {r.user_readable_id||'—'}</p></td>
                                                <td className="px-6 py-4 max-w-[200px]"><p className="text-[10px] text-white/50 truncate">{r.note||'—'}</p></td>
                                                <td className="px-6 py-4 text-right"><span className="text-[11px] font-black text-white/70">R {parseFloat(r.amount||'0').toFixed(2)}</span></td>
                                                <td className="px-6 py-4 text-right"><span className="text-[11px] font-black text-violet-400">+R {parseFloat(r.commission||'0').toFixed(2)}</span></td>
                                                <td className="px-6 py-4 text-right"><p className="text-[10px] font-bold text-white/40">{timeAgo(r.created_at)}</p><p className="text-[9px] text-white/20 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

            ) : walletView === 'capital-history' ? (
                /* ── Capital History sub-view (Add Capital + Capital Transfer) ── */
                <div className="space-y-6">
                    <SubViewHeader label="Capital History" color="text-white" />

                    {/* ── Add Capital History ── */}
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                                <IonIcon name="add-circle-outline" className="text-sm" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Section 1</p>
                                <h2 className="text-sm font-black uppercase tracking-tight text-emerald-400">Add Capital History</h2>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-[9px] font-black text-white/50">{capAddRows.length} record{capAddRows.length !== 1 ? 's' : ''}</p>
                                <p className="text-[8px] text-white/20">Total: R {capAddRows.reduce((s,r)=>s+parseFloat(r.amount||'0'),0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                            </div>
                        </div>
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
                            {capAddLoading ? <div className="p-10 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</div>
                            : capAddRows.length === 0 ? <div className="p-10 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-white/25">No capital additions yet</p></div>
                            : (
                                <div className="w-full overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead><tr className="border-b border-white/[0.06] text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                                            <th className="px-6 py-4">Admin</th><th className="px-6 py-4">Note</th><th className="px-6 py-4 text-right">Amount Added</th><th className="px-6 py-4 text-right">When</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-white/[0.04]">
                                            {capAddRows.map((r, i) => (
                                                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-4"><p className="text-[11px] font-bold text-white">{r.sender_name||'Unknown'}</p><p className="text-[9px] text-white/40 mt-0.5">@{r.username||'—'}</p></td>
                                                    <td className="px-6 py-4 max-w-[200px]"><p className="text-[10px] text-white/50 truncate">{r.note||'—'}</p></td>
                                                    <td className="px-6 py-4 text-right"><span className="text-[11px] font-black text-emerald-400">+R {parseFloat(r.amount||'0').toFixed(2)}</span></td>
                                                    <td className="px-6 py-4 text-right"><p className="text-[10px] font-bold text-white/40">{timeAgo(r.created_at)}</p><p className="text-[9px] text-white/20 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Capital Transfer History ── */}
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                                <IonIcon name="swap-vertical-outline" className="text-sm" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Section 2</p>
                                <h2 className="text-sm font-black uppercase tracking-tight text-blue-400">Capital Transfer History</h2>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-[9px] font-black text-white/50">{histRows.length} record{histRows.length !== 1 ? 's' : ''}</p>
                                <p className="text-[8px] text-white/20">Total: R {histRows.reduce((s,r)=>s+parseFloat(r.transfer_amount||'0'),0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                            </div>
                        </div>
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
                            {histLoading ? <div className="p-10 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</div>
                            : histRows.length === 0 ? <div className="p-10 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-white/25">No transfers yet</p></div>
                            : (
                                <div className="w-full overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead><tr className="border-b border-white/[0.06] text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                                            <th className="px-6 py-4">Admin</th><th className="px-6 py-4">Note</th><th className="px-6 py-4 text-right">Amount</th><th className="px-6 py-4 text-right">When</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-white/[0.04]">
                                            {histRows.map((r, i) => (
                                                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-4"><p className="text-[11px] font-bold text-white">{r.sender_name||'Unknown'}</p><p className="text-[9px] text-white/40 mt-0.5">@{r.username||'—'}</p></td>
                                                    <td className="px-6 py-4 max-w-[200px]"><p className="text-[10px] text-white/50 truncate">{r.note||'—'}</p></td>
                                                    <td className="px-6 py-4 text-right"><span className="text-[11px] font-black text-blue-400">R {parseFloat(r.transfer_amount||'0').toFixed(2)}</span></td>
                                                    <td className="px-6 py-4 text-right"><p className="text-[10px] font-bold text-white/40">{timeAgo(r.created_at)}</p><p className="text-[9px] text-white/20 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            ) : (
                /* ── Main wallet dashboard ── */
                <div className="space-y-5">
                    {/* Balance cards */}
                    <div className="grid grid-cols-2 gap-3 max-w-xl">
                        {/* Personal wallet */}
                        <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] overflow-hidden">
                            <div className="p-3.5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/45">
                                        <IonIcon name="wallet-outline" className="text-xs" />
                                    </div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Available Capital</p>
                                </div>
                                <p className="text-lg font-black tracking-tight text-white">R {userBalance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                                <p className="mt-0.5 text-[8px] font-bold text-white/35">Available to transfer</p>
                            </div>
                            <div className="border-t border-white/[0.06] px-3 py-2.5 space-y-2">
                                <div className="flex gap-1.5">
                                    <button onClick={() => setShowTransferModal(true)}
                                        className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] py-2 text-[8px] font-black uppercase tracking-widest text-blue-400 transition hover:bg-blue-500/[0.14]">
                                        <IonIcon name="swap-vertical-outline" className="text-xs" />
                                        Transfer
                                    </button>
                                    <button onClick={() => setWalletView('capital-history')}
                                        className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[8px] font-black uppercase tracking-widest text-white/45 transition hover:bg-white/[0.08] hover:text-white/70">
                                        <IonIcon name="time-outline" className="text-xs" />
                                        History
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Googer balance — expandable */}
                        <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] overflow-hidden">
                            <button onClick={() => setGoogerExpanded(v => !v)} className="w-full p-3.5 text-left hover:bg-white/[0.02] transition">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/45">
                                        <IonIcon name="business-outline" className="text-xs" />
                                    </div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Googer Balance</p>
                                    <IonIcon name={googerExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} className="ml-auto text-[11px] text-white/25" />
                                </div>
                                <p className="text-lg font-black tracking-tight text-white">R {googerBalance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                                <p className="mt-0.5 text-[8px] font-bold text-white/35">System Total Holding</p>
                            </button>
                            {googerExpanded && (
                                <div className="border-t border-white/[0.06] p-4 space-y-2">
                                    {[
                                        { view: 'commissions' as WalletView,      icon: 'logo-bitcoin',          label: 'Googer Commissions', sub: 'Ad coin collecting income',     border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.06]', hover: 'hover:bg-emerald-500/[0.10]', text: 'text-emerald-400', chevron: 'text-emerald-400/40' },
                                        { view: 'ads-profit' as WalletView,       icon: 'person-circle-outline', label: 'Googer Ads Profit',   sub: 'Profile promote ad income',   border: 'border-violet-500/20', bg: 'bg-violet-500/[0.06]',  hover: 'hover:bg-violet-500/[0.10]',  text: 'text-violet-400', chevron: 'text-violet-400/40' },
                                        { view: 'capital-history' as WalletView,  icon: 'swap-vertical-outline', label: 'Capital Transfer',    sub: 'Wallet → Googer history',     border: 'border-blue-500/20',   bg: 'bg-blue-500/[0.06]',    hover: 'hover:bg-blue-500/[0.10]',    text: 'text-blue-400',   chevron: 'text-blue-400/40' },
                                    ].map(btn => (
                                        <button key={btn.view} onClick={() => setWalletView(btn.view)}
                                            className={`w-full flex items-center gap-3 rounded-2xl border ${btn.border} ${btn.bg} px-4 py-3 text-left transition ${btn.hover}`}>
                                            <IonIcon name={btn.icon} className={`text-base ${btn.text}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-wide text-white">{btn.label}</p>
                                                <p className="text-[8px] text-white/30 mt-0.5">{btn.sub}</p>
                                            </div>
                                            <IonIcon name="chevron-forward-outline" className={`text-[10px] ${btn.chevron}`} />
                                        </button>
                                    ))}
                                    <button onClick={() => openUtModal('transfer')}
                                        className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08]">
                                        <IonIcon name="people-outline" className="text-base text-white/50" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-wide text-white">Transfer for Admin</p>
                                            <p className="text-[8px] text-white/30 mt-0.5">Send wallet funds to admin accounts</p>
                                        </div>
                                        <IonIcon name="chevron-forward-outline" className="text-[10px] text-white/25" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add Capital */}
                    <div className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/[0.04] p-5 space-y-5">
                        <div className="flex items-center gap-3 pb-4 border-b border-emerald-500/[0.12]">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                                <IonIcon name="add-circle-outline" className="text-sm" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-tight text-white">Add Capital to Wallet</h3>
                                <p className="text-[9px] text-white/35">Add funds directly to your personal admin wallet balance</p>
                            </div>
                        </div>
                        {capSuccess && (
                            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                                <IonIcon name="checkmark-circle-outline" className="shrink-0 text-sm text-emerald-400" />
                                <p className="text-[10px] font-bold text-emerald-300">{capSuccess}</p>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Amount to Add</span>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-black text-white/35">R</span>
                                <input type="number" value={capitalAmount} onChange={e => { setCapitalAmount(e.target.value); setCapSuccess(''); }} placeholder="0.00" min="0.01" step="0.01"
                                    className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-8 pr-4 font-mono text-sm font-bold text-white placeholder-white/20 outline-none transition focus:border-emerald-500/30" />
                            </div>
                            {capWords && <p className="text-[9px] font-bold text-emerald-400/60 px-1">R {capWords}</p>}
                        </div>
                        <button onClick={() => { if (capitalAmount && Number(capitalAmount) > 0) { setCapError(''); setShowCapModal(true); } }}
                            disabled={!capitalAmount || Number(capitalAmount) <= 0}
                            className="w-full rounded-2xl bg-emerald-500 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">
                            Add Capital to Wallet
                        </button>
                    </div>
                </div>
            )}

            {/* Add Capital modal */}
            {showCapModal && (
                <AddCapitalModal amount={Number(capitalAmount)} onConfirm={handleConfirmCapital} onClose={() => setShowCapModal(false)} submitting={capSubmitting} error={capError} setError={setCapError} />
            )}

            {/* Transfer modal */}
            {showTransferModal && (
                <TransferModal
                    userBalance={userBalance}
                    onSuccess={(newBal) => { setUserBalance(newBal); setShowTransferModal(false); void fetchBalances(); }}
                    onClose={() => setShowTransferModal(false)}
                />
            )}

            {/* User & Admin Transfer popup */}
            {showUtModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/50">
                                    <IonIcon name="people-outline" className="text-base" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Admin Action</p>
                                    <h3 className="text-sm font-black uppercase tracking-tight text-white">Transfer for Admin</h3>
                                </div>
                            </div>
                            <button onClick={() => { setShowUtModal(false); setUtSelected(null); setUtAmount(''); setUtNote(''); setUtError(''); setUtSuccess(''); setUtPasswordStep(false); setUtPassword(''); }}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white transition">
                                <IonIcon name="close-outline" className="text-sm" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 px-4 pt-4 shrink-0">
                            {(['transfer', 'history'] as const).map(tab => (
                                <button key={tab} onClick={() => { setUtModalTab(tab); if (tab === 'history' && utHistory.length === 0) loadUtHistory(); }}
                                    className={`flex-1 rounded-2xl py-2.5 text-[9px] font-black uppercase tracking-widest transition ${utModalTab === tab ? 'bg-white text-black' : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70'}`}>
                                    {tab === 'transfer' ? 'Transfer' : 'History'}
                                </button>
                            ))}
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto flex-1 p-4 space-y-4">
                            {utModalTab === 'transfer' ? (
                                <>
                                    {utError && (
                                        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                                            <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
                                            <p className="text-[10px] font-bold text-rose-300">{utError}</p>
                                        </div>
                                    )}
                                    {utSuccess && (
                                        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                                            <IonIcon name="checkmark-circle-outline" className="shrink-0 text-sm text-emerald-400" />
                                            <p className="text-[10px] font-bold text-emerald-300">{utSuccess}</p>
                                        </div>
                                    )}

                                    {/* Selected user chip */}
                                    {utSelected ? (
                                        <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/50 shrink-0">
                                                <IonIcon name="person-outline" className="text-sm" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-bold text-white truncate">{utSelected.user_type?.toLowerCase() === 'admin' ? `@${utSelected.username}` : (utSelected.full_name || utSelected.username)}</p>
                                                <p className="text-[9px] text-white/35 mt-0.5">@{utSelected.username} · {utSelected.user_type}</p>
                                            </div>
                                            <button onClick={() => setUtSelected(null)}
                                                className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10">
                                                Change
                                            </button>
                                        </div>
                                    ) : (
                                        /* User search + list */
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <IonIcon name="search-outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-white/25" />
                                                <input type="text" value={utSearch} onChange={e => setUtSearch(e.target.value)} placeholder="Search by name or username..."
                                                    className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 pl-8 pr-4 text-[10px] text-white placeholder-white/20 outline-none transition focus:border-white/25" />
                                            </div>
                                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden max-h-48 overflow-y-auto">
                                                {utUsersLoading ? (
                                                    <p className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading users...</p>
                                                ) : utUsers.filter(u => u.username?.toLowerCase() !== 'admin' && ['admin','super_admin'].includes(u.user_type?.toLowerCase() ?? '') && (!utSearch || u.full_name?.toLowerCase().includes(utSearch.toLowerCase()) || u.username?.toLowerCase().includes(utSearch.toLowerCase()))).length === 0 ? (
                                                    <p className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-white/25">No admin users found</p>
                                                ) : (
                                                    <div className="divide-y divide-white/[0.04]">
                                                        {utUsers
                                                            .filter(u => u.username?.toLowerCase() !== 'admin' && ['admin','super_admin'].includes(u.user_type?.toLowerCase() ?? '') && (!utSearch || u.full_name?.toLowerCase().includes(utSearch.toLowerCase()) || u.username?.toLowerCase().includes(utSearch.toLowerCase())))
                                                            .map(u => (
                                                                <button key={u.id} onClick={() => { setUtSelected(u); setUtSearch(''); setUtError(''); setUtSuccess(''); }}
                                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.05] transition">
                                                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.07] text-white/40 shrink-0">
                                                                        <IonIcon name="person-outline" className="text-xs" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[10px] font-bold text-white truncate">{u.user_type?.toLowerCase() === 'admin' ? `@${u.username}` : (u.full_name || u.username)}</p>
                                                                        <p className="text-[8px] text-white/30 mt-0.5">@{u.username} · {u.user_type}</p>
                                                                    </div>
                                                                    <span className="text-[9px] font-mono text-white/25 shrink-0">R {parseFloat(u.wallet_balance||'0').toFixed(2)}</span>
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Amount */}
                                    <div className="space-y-1.5">
                                        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Amount</span>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-black text-white/35">R</span>
                                            <input type="number" value={utAmount} onChange={e => { setUtAmount(e.target.value); setUtError(''); setUtSuccess(''); setUtPasswordStep(false); }} placeholder="0.00" min="0.01" step="0.01"
                                                className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-8 pr-4 font-mono text-sm font-bold text-white placeholder-white/20 outline-none transition focus:border-white/25" />
                                        </div>
                                        {numberToWords(Number(utAmount)) && <p className="text-[9px] font-bold text-white/40 px-1">R {numberToWords(Number(utAmount))}</p>}
                                        <p className="text-[9px] text-white/20 px-1">Googer Balance: R {googerBalance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                                    </div>

                                    {/* Note */}
                                    <div className="space-y-1.5">
                                        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Note <span className="text-white/20 normal-case font-bold tracking-normal">(optional)</span></span>
                                        <input type="text" value={utNote} onChange={e => setUtNote(e.target.value)} placeholder="Reason for transfer..."
                                            className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 px-4 text-[10px] text-white placeholder-white/20 outline-none transition focus:border-white/25" />
                                    </div>

                                    {/* Password confirmation step */}
                                    {utPasswordStep && (
                                        <div className="space-y-1.5">
                                            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Confirm Password</span>
                                            <div className="relative">
                                                <IonIcon name="lock-closed-outline" className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] text-white/25" />
                                                <input
                                                    type="password"
                                                    value={utPassword}
                                                    onChange={e => { setUtPassword(e.target.value); setUtError(''); }}
                                                    placeholder="Enter your admin password"
                                                    autoFocus
                                                    className="w-full rounded-2xl border border-orange-500/30 bg-orange-500/[0.05] py-3 pl-10 pr-4 text-[10px] text-white placeholder-white/20 outline-none transition focus:border-orange-500/50"
                                                />
                                            </div>
                                            <p className="text-[9px] text-orange-400/70 px-1">Password required to confirm this transfer</p>
                                        </div>
                                    )}

                                    {/* Transfer button */}
                                    <button onClick={handleUtTransfer} disabled={!utSelected || !utAmount || Number(utAmount) <= 0 || utSubmitting}
                                        className="w-full rounded-2xl bg-white py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed">
                                        {utSubmitting
                                            ? <span className="flex items-center justify-center gap-2"><span className="h-3.5 w-3.5 animate-spin rounded-full border border-black/20 border-t-black" />Transferring...</span>
                                            : utPasswordStep ? 'Confirm & Transfer' : 'Transfer'}
                                    </button>
                                </>
                            ) : (
                                /* History tab */
                                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                                    <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                                        <IonIcon name="time-outline" className="text-sm text-white/40" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Transfer History</span>
                                        <span className="ml-auto text-[8px] text-white/20">Permanent record</span>
                                    </div>
                                    {utHistLoading ? (
                                        <p className="p-8 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</p>
                                    ) : utHistory.length === 0 ? (
                                        <p className="p-8 text-center text-[10px] font-black uppercase tracking-widest text-white/25">No transfers yet</p>
                                    ) : (
                                        <div className="w-full overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-white/[0.06] text-[8px] font-black uppercase tracking-[0.18em] text-white/25">
                                                        <th className="px-4 py-3">From</th>
                                                        <th className="px-4 py-3">To</th>
                                                        <th className="px-4 py-3">Note</th>
                                                        <th className="px-4 py-3 text-right">Amount</th>
                                                        <th className="px-4 py-3 text-right">When</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.04]">
                                                    {utHistory.map((r, i) => (
                                                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-4 py-3">
                                                                <p className="text-[10px] font-bold text-white truncate max-w-[90px]">{r.sender_name || 'Unknown'}</p>
                                                                <p className="text-[8px] text-white/30 mt-0.5 uppercase tracking-widest">{r.sender_type}</p>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <p className="text-[10px] font-bold text-white truncate max-w-[90px]">{r.receiver_name || 'Unknown'}</p>
                                                                <p className="text-[8px] text-white/30 mt-0.5">@{r.receiver_username || '—'}</p>
                                                            </td>
                                                            <td className="px-4 py-3 max-w-[120px]">
                                                                <p className="text-[9px] text-white/40 truncate">{r.note || '—'}</p>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <span className="text-[10px] font-black text-white">R {parseFloat(r.amount||'0').toFixed(2)}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <p className="text-[9px] font-bold text-white/40">{timeAgo(r.created_at)}</p>
                                                                <p className="text-[8px] text-white/20 mt-0.5">{new Date(r.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
