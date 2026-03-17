"use client";

import AllUsersPage from "../all/page";

export default function SellersPage() {
  // In a real app we might pass a filter prop, but for now we'll just reuse the page 
  // and it will show all users (including sellers). 
  // If we had a specific seller filter in API we'd use it.
  return <AllUsersPage />;
}
