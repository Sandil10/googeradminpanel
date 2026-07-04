"use client";

import ProductsTable from "@/components/ProductsTable";

export default function ReviewProductsPage() {
  return (
    <ProductsTable 
        title="Review Products" 
        description="Products flagged for manual review or verification." 
        statusFilter="reviewing"
    />
  );
}
