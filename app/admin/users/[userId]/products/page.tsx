"use client";

import ProductsTable from "@/components/ProductsTable";
import { use, useEffect, useState } from "react";
import { adminService } from "@/services/adminService";
import IonIcon from "@/components/IonIcon";
import { useRouter } from "next/navigation";

export default function UserProductsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const loadUserName = async () => {
      try {
        const userData = await adminService.fetchUserDetails(userId);
        setUserName(userData.full_name || userData.username);
      } catch (err) {
        console.error(err);
      }
    };
    loadUserName();
  }, [userId]);

  return (
    <div className="space-y-6">
       <button 
           onClick={() => router.back()}
           className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 active:scale-95 mb-4"
       >
           <IonIcon name="arrow-back" />
           Back to Profile
       </button>

       <ProductsTable 
           title={userName ? `${userName}'s Products` : "User Products"}
           description={`Audit all active, rejected, or hidden products belonging to this account.`}
           userId={userId}
       />
    </div>
  );
}
