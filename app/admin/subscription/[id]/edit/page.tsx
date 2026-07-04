"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PlanForm from "../../PlanForm";
import { adminService } from "@/services/adminService";
import { type Plan } from "../../planUtils";
import IonIcon from "@/components/IonIcon";

export default function EditSubscriptionPlanPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [plan, setPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const result = await adminService.fetchSubscriptionPlans();
                const found = (result.data as Plan[]).find(p => String(p.id) === id);
                if (!found) {
                    setError('Plan not found.');
                } else {
                    setPlan(found);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !plan) {
        return (
            <div className="p-6 max-w-md mx-auto text-center mt-16">
                <IonIcon name="alert-circle-outline" className="text-5xl text-red-400 mb-3" />
                <p className="text-red-400 font-semibold mb-4">{error || 'Plan not found.'}</p>
                <button
                    onClick={() => router.push('/admin/subscription')}
                    className="text-sm text-gray-400 underline hover:text-white"
                >
                    Back to Subscription Plans
                </button>
            </div>
        );
    }

    return <PlanForm initialPlan={plan} />;
}
