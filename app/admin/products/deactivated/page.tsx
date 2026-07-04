"use client";

import ProductsTable from "@/components/ProductsTable";

export default function DeactivatedProductsPage() {
  return (
    <ProductsTable 
        title="Deactivated Products" 
        description="Products that have been manually hidden from the marketplace by administrators." 
        statusFilter="inactive"
    />
  );
}
