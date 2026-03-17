"use client";

import ProductsTable from "@/components/ProductsTable";

export default function NewProductsPage() {
  return (
    <ProductsTable 
        title="New Products" 
        description="Review and approve newly submitted items before they go live." 
        statusFilter="pending,reviewing"
    />
  );
}
