"use client";

import { usePathname } from "next/navigation";
import ProductsSectionNav from "@/components/ProductsSectionNav";

export default function ProductsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const hideProductsNav = pathname.startsWith("/admin/products/ads");

    return (
        <div className="space-y-6">
            {!hideProductsNav && <ProductsSectionNav />}
            {children}
        </div>
    );
}
