"use client";

import ProductsTable from "@/components/ProductsTable";

export default function ActiveProductsPage() {
  return (
    <ProductsTable 
        title="Active Products" 
        description="Items currently visible and purchasable in the marketplace." 
        statusFilter="active"
    />
  );
}
