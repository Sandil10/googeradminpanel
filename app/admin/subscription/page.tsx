"use client";

import IonIcon from "@/components/IonIcon";

export default function SubscriptionPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-white mb-6">Subscription Management</h1>
            <div className="bg-[#162033] border border-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                    <IonIcon name="card-outline" className="text-3xl text-blue-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Coming Soon</h3>
                <p className="text-gray-400 max-w-md">
                    This feature is currently under development. You will be able to manage user subscriptions here shortly.
                </p>
            </div>
        </div>
    );
}
