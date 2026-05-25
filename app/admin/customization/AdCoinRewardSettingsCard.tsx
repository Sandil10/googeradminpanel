"use client";

import { useEffect, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

type InputValues = {
    userRewardAmount: string;
    googerCommissionAmount: string;
    advertiserChargeAmount: string;
    requiredWatchSeconds: string;
};

const DEFAULTS: InputValues = {
    userRewardAmount: "1",
    googerCommissionAmount: "0.25",
    advertiserChargeAmount: "1.25",
    requiredWatchSeconds: "15",
};

const toNum = (s: string) => {
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : 0;
};

export default function AdCoinRewardSettingsCard() {
    const [loading, setLoading] = useState(true);
    const [savingRewards, setSavingRewards] = useState(false);
    const [savingWatchTime, setSavingWatchTime] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [inputs, setInputs] = useState<InputValues>(DEFAULTS);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await adminService.fetchAdCoinRewardSettings();
            const s = response?.settings || response?.data || response?.rewardSettings;
            if (s) {
                setInputs({
                    userRewardAmount: String(s.userRewardAmount ?? s.user_reward_amount ?? DEFAULTS.userRewardAmount),
                    googerCommissionAmount: String(s.googerCommissionAmount ?? s.googer_commission_amount ?? DEFAULTS.googerCommissionAmount),
                    advertiserChargeAmount: String(s.advertiserChargeAmount ?? s.advertiser_charge_amount ?? DEFAULTS.advertiserChargeAmount),
                    requiredWatchSeconds: String(s.requiredWatchSeconds ?? s.required_watch_seconds ?? DEFAULTS.requiredWatchSeconds),
                });
            }
            setMessage(null);
        } catch (error: any) {
            setMessage(error.message || "Failed to load ad coin rewards");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const getParsedValues = () => {
        const userRewardAmount = toNum(inputs.userRewardAmount);
        const googerCommissionAmount = toNum(inputs.googerCommissionAmount);
        const advertiserChargeAmount = toNum(inputs.advertiserChargeAmount);
        const requiredWatchSeconds = Math.max(0, Math.trunc(toNum(inputs.requiredWatchSeconds)));

        return {
            userRewardAmount,
            googerCommissionAmount,
            advertiserChargeAmount,
            requiredWatchSeconds,
        };
    };

    const syncInputsFromSettings = (settings: any, fallback: ReturnType<typeof getParsedValues>) => {
        if (settings) {
            setInputs({
                userRewardAmount: String(settings.userRewardAmount ?? settings.user_reward_amount ?? fallback.userRewardAmount),
                googerCommissionAmount: String(settings.googerCommissionAmount ?? settings.googer_commission_amount ?? fallback.googerCommissionAmount),
                advertiserChargeAmount: String(settings.advertiserChargeAmount ?? settings.advertiser_charge_amount ?? fallback.advertiserChargeAmount),
                requiredWatchSeconds: String(settings.requiredWatchSeconds ?? settings.required_watch_seconds ?? fallback.requiredWatchSeconds),
            });
        }
    };

    const handleSaveRewards = async () => {
        const { userRewardAmount, googerCommissionAmount, advertiserChargeAmount, requiredWatchSeconds } = getParsedValues();

        if (userRewardAmount < 0 || googerCommissionAmount < 0 || advertiserChargeAmount < 0) {
            setMessage("Reward values cannot be negative");
            return;
        }

        const expectedCharge = Number((userRewardAmount + googerCommissionAmount).toFixed(2));
        const mismatch = Number(advertiserChargeAmount.toFixed(2)) !== expectedCharge;
        const allowMismatch = mismatch
            ? window.confirm(
                `Advertiser charge should normally be R ${expectedCharge.toFixed(2)}.\n\nContinue and save this custom override?`
            )
            : true;

        if (!allowMismatch) return;

        try {
            setSavingRewards(true);
            const response = await adminService.updateAdCoinRewardSettings({
                userRewardAmount,
                googerCommissionAmount,
                advertiserChargeAmount,
                requiredWatchSeconds,
                allowMismatch,
            });
            const s = response?.settings || response?.data || response?.rewardSettings;
            syncInputsFromSettings(s, { userRewardAmount, googerCommissionAmount, advertiserChargeAmount, requiredWatchSeconds });
            setMessage("Ad coin reward amounts saved");
        } catch (error: any) {
            setMessage(error.message || "Failed to save ad coin reward settings");
        } finally {
            setSavingRewards(false);
        }
    };

    const handleSaveWatchTime = async () => {
        const { userRewardAmount, googerCommissionAmount, advertiserChargeAmount, requiredWatchSeconds } = getParsedValues();

        try {
            setSavingWatchTime(true);
            const response = await adminService.updateAdCoinRewardSettings({
                userRewardAmount,
                googerCommissionAmount,
                advertiserChargeAmount,
                requiredWatchSeconds,
                allowMismatch: true,
            });
            const s = response?.settings || response?.data || response?.rewardSettings;
            syncInputsFromSettings(s, { userRewardAmount, googerCommissionAmount, advertiserChargeAmount, requiredWatchSeconds });
            setMessage("Video ad watch time saved");
        } catch (error: any) {
            setMessage(error.message || "Failed to save video ad watch time");
        } finally {
            setSavingWatchTime(false);
        }
    };

    const userNum = toNum(inputs.userRewardAmount);
    const commNum = toNum(inputs.googerCommissionAmount);
    const chargeNum = toNum(inputs.advertiserChargeAmount);
    const expectedCharge = Number((userNum + commNum).toFixed(2));
    const chargeMatches = Number(chargeNum.toFixed(2)) === expectedCharge;

    return (
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Ad Coin Commission Settings</p>
                    <h3 className="text-sm font-black uppercase text-white">Collect Coin Rewards</h3>
                </div>
                <IonIcon name="cash-outline" className="text-xl text-emerald-300" />
            </div>

            {message && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/75">
                    {message}
                </div>
            )}

            {loading ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                    Loading reward settings...
                </div>
            ) : (
                <>
                    <div className="rounded-3xl border border-white/8 bg-black/20 p-4 space-y-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Reward Amount Settings</p>
                        <div className="grid gap-4 md:grid-cols-3">
                            <label className="space-y-2">
                                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">User Reward Amount</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={inputs.userRewardAmount}
                                    onChange={(e) => setInputs((prev) => ({ ...prev, userRewardAmount: e.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                                />
                            </label>
                            <label className="space-y-2">
                                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Googer Commission Amount</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={inputs.googerCommissionAmount}
                                    onChange={(e) => setInputs((prev) => ({ ...prev, googerCommissionAmount: e.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                                />
                            </label>
                            <label className="space-y-2">
                                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Advertiser Charge Amount</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={inputs.advertiserChargeAmount}
                                    onChange={(e) => setInputs((prev) => ({ ...prev, advertiserChargeAmount: e.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                                />
                            </label>
                        </div>

                        <div className={`rounded-2xl border px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${chargeMatches ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-amber-400/20 bg-amber-500/10 text-amber-200"}`}>
                            {chargeMatches
                                ? `Charge matches reward formula: R ${expectedCharge.toFixed(2)}`
                                : `Custom override active. Expected charge: R ${expectedCharge.toFixed(2)}`}
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveRewards}
                            disabled={savingRewards}
                            className="rounded-2xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white/90 disabled:opacity-60"
                        >
                            {savingRewards ? "Saving..." : "Save Reward Amounts"}
                        </button>
                    </div>

                    <div className="rounded-3xl border border-white/8 bg-black/20 p-4 space-y-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Video Ad Time Setting</p>
                        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
                            <label className="space-y-2">
                                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Required Watch Seconds</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={inputs.requiredWatchSeconds}
                                    onChange={(e) => setInputs((prev) => ({ ...prev, requiredWatchSeconds: e.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                                />
                            </label>
                            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.05] px-4 py-3">
                                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200/75">Video Ads</p>
                                <p className="mt-2 text-xs font-semibold leading-6 text-white/60">
                                    Admin can change how many seconds a user must watch before coin collection becomes eligible for Photo/Video ads.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveWatchTime}
                            disabled={savingWatchTime}
                            className="rounded-2xl bg-cyan-300 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-cyan-200 disabled:opacity-60"
                        >
                            {savingWatchTime ? "Saving..." : "Save Video Watch Time"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
