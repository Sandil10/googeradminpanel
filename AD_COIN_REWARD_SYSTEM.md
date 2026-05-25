# Ad Coin Reward System

## What Changed

- Added DB-backed ad coin reward settings for Collect Coin actions.
- Added admin-editable settings for:
  - User Reward Amount
  - Googer Commission Amount
  - Advertiser Charge Amount
- Added a new `ad_coin_reward_settings` table with a default active row when empty.
- Extended `ad_coin_collections` to store the actual reward values used at collection time.
- Updated Collect Coin / Like coin flow to read settings from the database on every click.
- Added admin-only APIs to read and update the ad coin reward settings.
- Added an Admin Panel section to manage the reward values.

## Default Values

- `user_reward_amount = 1.00`
- `googer_commission_amount = 0.25`
- `advertiser_charge_amount = 1.25`

## Behavior

- The frontend does not send reward amounts.
- The backend decides the reward, commission, and advertiser charge from the active DB settings.
- Duplicate collection is blocked with a unique constraint.
- Wallet updates happen inside a single database transaction.
- Existing collection records are not modified when reward settings change.

## Files

- `controllers/adCoinController.js`
- `controllers/adCoinRewardSettings.js`
- `middleware/adminOnly.js`
- `routes/admin-customization.js`
- `app/admin/customization/AdCoinRewardSettingsCard.tsx`
- `app/admin/customization/CustomizationClient.tsx`
- `app/services/adService.ts`
- `app/services/adminService.ts`

