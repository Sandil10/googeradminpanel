"use client";

export default function AdsHistoryPage() {
    return (
        <div className="space-y-6">
            <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Ads</p>
                <h1 className="mt-1 text-xl font-black uppercase tracking-tight text-white">Transaction History</h1>
                <p className="mt-2 max-w-2xl text-sm font-medium text-white/45">
                    Open any transaction category from the history bar below.
                </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">History Navigation</p>
                <h2 className="mt-2 text-lg font-black uppercase tracking-tight text-white">Choose A Category</h2>
                <p className="mt-2 max-w-3xl text-[11px] font-semibold leading-6 text-white/50">
                    Each button in the history bar opens a dedicated transaction table with live updates, real timestamps,
                    signed credit and refund amounts, and 10 rows per page.
                </p>
            </div>
        </div>
    );
}
