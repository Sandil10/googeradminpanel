# ADMIN COMMISSION & CATEGORY CHANGES

## Summary

Implemented a DB-backed category hierarchy and commission management flow for the admin panel, added a server-side ad coin collection transaction with duplicate protection, and added per-main-category commission editing in the admin panel with auto-fill in the product add modal.

## Per-Main-Category Commission (2026-05-08)

### What changed

- **Removed** the top global "Category Commission" quick-edit bar from the admin Percentage Customization page header. The global commission value is still accessible and editable in the **Commissions** tab.
- **Admin UI**: Each Level 1 (main) category row now shows an **Edit %** button. Clicking it opens an inline input directly in the row — no popup. Type the new value (0–100) and click **Save**. Level 2 and Level 3 categories are display-only and unaffected.
- **DB storage**: Commission is stored in `managed_categories.commission_percentage` (the existing column). No separate table is needed because `commission_percentage` is already the authoritative per-category field.
- **Backend endpoints added**:
  - `GET /api/categories/:id/commission` — public; returns commission for a main category by ID. Used as a standalone lookup if needed.
  - `PATCH /api/admin/customization/categories/:id/commission` — updates `commission_percentage` for a Level 1 category. Validates 0 ≤ value ≤ 100.
- **Product Add Modal**: When a seller selects a main category, `googerCommission` is auto-filled from that category's `commission_percent` (already returned inside the category tree). If the category has 0 or no commission, falls back to `generalCategoryCommission` from the global commission settings.

### Design note — why not a separate `category_commissions` table

The `managed_categories` table already has a `commission_percentage` column that is always present (defaults to 0). Adding a parallel table would duplicate the data and require a join on every category tree load. Using the existing column avoids migration risk and keeps the read path simple.

### Files changed in this update

- `controllers/categoryCommissionController.js` *(new)*
- `routes/categories.js`
- `routes/admin-customization.js`
- `app/services/adminService.ts`
- `app/admin/customization/CategoryTable.tsx`
- `app/admin/customization/CustomizationClient.tsx`
- `app/components/AddProductModal.tsx`

---

## Category System Changes

- Replaced the demo/static admin category area with real category data from PostgreSQL.
- Added a new `category_nodes` table for Level 1, Level 2, and Level 3 categories.
- Added a public category tree endpoint for the product add modal.
- Added admin endpoints to create, edit, and delete categories.
- Added commission values per category row using `commission_percent`.
- Preserved existing product fields (`market.category`, `market.sub_category`, `market.level3_category`) so existing data stays safe.
- Added delete validation so categories cannot be removed while products still reference them.
- Added hierarchy validation so:
- Level 2 categories must have a Level 1 parent.
- Level 3 categories must have a Level 2 parent.

## Safe Market Snapshot

- The admin customization page now also loads a live, read-only category snapshot directly from the `market` table.
- That snapshot is display-only and does not write anything to the database when the page loads.
- The editable category controls still use `category_nodes`, so add/edit/delete actions remain isolated from product rows.
- A new public `/api/admin/customization/public-overview` route serves the read-only snapshot, while the existing `/overview` and category save routes remain protected.

## Commission Changes

- Added a `commission_settings` table for persisted commission values.
- Google Commission now loads from the database instead of a hard-coded input.
- Added admin save/reset support for Google Commission.
- Added persisted Ad Commission settings for:
- Referral Multiplier
- Ad Click Commission
- Pre-ad Commission
- General Category Commission
- Category-specific commission values are now editable for each category level.
- All commission values reload from the database after refresh.

## Product Add Modal

- Switched category dropdowns from static demo lists to the live DB category tree.
- Newly added categories now appear in the admin category list and in the product add modal dropdowns after refresh.
- Kept the fallback hierarchy only as a safety net if the category service is unavailable.

## Ad Coin Collection

- Added a new `ad_coin_collections` table with a unique constraint on:
- `ad_id + ad_type + user_id`
- Added a server-side collect coin API for ads.
- Added a shared ad reward flow for both Like and Collect Coin buttons.
- The transaction now:
- Validates login
- Validates ad existence
- Validates advertiser wallet balance
- Uses a DB transaction for all money updates
- Prevents duplicate collection attempts
- Saves commission into `wallet_transfers.commission`
- Marks the transfer `accepted`

## Money Rules

- Advertiser balance decreases by `Rs. 1.25`
- Clicked user wallet increases by `Rs. 1.00`
- Googer commission is `Rs. 0.25`
- Googer wallet balance continues to be calculated from:

```sql
SELECT SUM(commission) FROM wallet_transfers WHERE status = 'accepted';
```

## Files Changed

- `[controllers/customizationController.js](./controllers/customizationController.js)`
- `[controllers/adCoinController.js](./controllers/adCoinController.js)`
- `[routes/categories.js](./routes/categories.js)`
- `[routes/admin-customization.js](./routes/admin-customization.js)`
- `[routes/ads.js](./routes/ads.js)`
- `[server.js](./server.js)`
- `[app/services/categoryService.ts](./app/services/categoryService.ts)`
- `[app/services/adService.ts](./app/services/adService.ts)`
- `[app/services/adminService.ts](./app/services/adminService.ts)`
- `[app/components/AddProductModal.tsx](./app/components/AddProductModal.tsx)`
- `[app/components/AdsTable.tsx](./app/components/AdsTable.tsx)`
- `[app/admin/customization/page.tsx](./app/admin/customization/page.tsx)`
- `[app/admin/customization/CustomizationClient.tsx](./app/admin/customization/CustomizationClient.tsx)`
- `[app/admin/customization/CategoryEditModal.tsx](./app/admin/customization/CategoryEditModal.tsx)`

## Verification

- TypeScript build check passed with `npx tsc --noEmit`.
- Backend route files passed `node -c` syntax checks.
