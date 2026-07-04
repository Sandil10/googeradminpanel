"use client";

import ProductsTable from "@/components/ProductsTable";

export default function RejectedProductsPage() {
  return (
    <ProductsTable 
        title="Rejected Products" 
        description="Products that have been reviewed and rejected by administrators." 
        statusFilter="rejected"
    />
  );
}
