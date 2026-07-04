# Googer Remaining Features Deep Dive

Status: completed deep-dive coverage for the previously remaining feature gaps
Date: 2026-06-17
Scope: saved content, moderation/reporting, reach and country targeting, share attribution, social graph, P2P proof-lock lifecycle

## 1. Purpose

This file closes the previously identified documentation gaps for:

- saved googs / saved ads / public saved-ad visibility
- reports moderation workflow
- reach tiers / allowed countries / ad policy operations
- public share-page attribution and reseller caching behavior
- followers / following / blocked-user graph
- detailed P2P buy/sell proof-lock lifecycle

## 2. Live table snapshot used for this doc

At audit time the shared DB contained:

- `saved_googs`: `0`
- `ad_saves`: `7`
- `user_subscriptions`: `4`
- `user_blocks`: `0`
- `goog_reports`: `7`
- `market_reports`: `8`
- `user_reports`: `1`
- `goog_comment_reports`: `1`
- `market_comment_reports`: `2`
- `ad_reports`: `2`
- `reach_tiers`: `16`
- `reach_settings`: `3`
- `p2p_transactions`: `25`
- `p2p_sell_transactions`: `29`
- `market_shares`: `177`
- `goog_shares`: `69`
- `goog_share_aliases`: `18`
- `product_share_aliases`: `0`

These numbers describe current live content, not capacity.

## 3. Saved Googs and Saved Ads

## Saved googs

### Main routes

- `GET /api/googs/saved`
- `GET /api/googs/saved/status`
- `POST /api/googs/:id/save`

### Main table

- `saved_googs`
  - `user_id`
  - `goog_id`
  - `saved_at`
  - unique pair: `(user_id, goog_id)`

### Logic

The goog save action is a toggle:

1. user hits `POST /api/googs/:id/save`
2. backend checks whether `(user_id, goog_id)` already exists
3. if yes:
   - row is deleted
   - response is `saved: false`
4. if no:
   - plan limits are loaded through `getUserPlanLimits(userId)`
   - `saveGoogLimit` is enforced
   - if allowed, row is inserted
   - response is `saved: true`

### Visibility rules

Saved googs are private to the saver.

`GET /api/googs/saved` joins:

- `saved_googs`
- `goog_posts`
- `users`

and filters out:

- inactive posts
- deactivated owners
- deactivated/deleted user rows

So a saved row can exist historically, but the read path only returns currently active content.

## Saved ads

### Main routes

- `GET /api/ads/saves`
- `GET /api/ads/saves/ids`
- `GET /api/ads/saves/counts`
- `GET /api/ads/saved-public/:userId`
- `POST /api/ads/:adId/save`

### Main table

- `ad_saves`
  - `user_id`
  - `ad_id`
  - `ad_media_type`
  - `ad_source_type`
  - `created_at`
  - unique pair: `(user_id, ad_id)`

### Save constraints

Only `Photo and Video` ads can be saved.

The backend classifies each saved ad into:

- `ad_media_type`
  - `photo`
  - `video`
- `ad_source_type`
  - `upload`
  - `link`

Plan limits are enforced only for upload-source saved ads:

- `video_ads_save_limit`
- `photo_ads_save_limit`

Link-style ads are not counted with the same limit logic.

### Private saved ads

`GET /api/ads/saves` returns the requesting user's saved ads and hides expired upload-style photo/video ads that have already completed and are no longer inside the profile-expiry rule window.

### Public saved ads

`GET /api/ads/saved-public/:userId` is intentionally narrow.

It only returns ads where:

- `s.user_id = profile user`
- `a.user_id = profile user`
- campaign type is `photo and video`
- ad status is `completed`

That means this is not a public dump of everything a user saved.
It is effectively a public-facing list of that user's own completed photo/video ads that are also in their saved collection.

## 4. Reports and Moderation Workflow

## User-side report creation

### Report entry points

- googs:
  - `POST /api/googs/:id/report`
- goog comments:
  - `POST /api/googs/comments/:commentId/report`
- products:
  - `POST /api/market/:id/report`
- market comments:
  - `POST /api/market/comments/:commentId/report`
- ads:
  - `POST /api/ads/:adId/report`
- users:
  - `POST /api/auth/user/:id/report`
- orders:
  - `POST /api/orders/:id/report`
- generic admin-panel report post:
  - `POST /api/reports`

### Tables involved

- `goog_reports`
- `goog_comment_reports`
- `market_reports`
- `market_comment_reports`
- `ad_reports`
- `user_reports`
- order-report fields inside `orders`:
  - `buyer_report`
  - `seller_report`
  - `report_status`
  - `report_by`

### Creation rules

Most report flows prevent duplicates by `(target, user)` uniqueness or a prior existence check.

Patterns:

- post/product/ad/user reports create or reject duplicate rows
- comment reports increment comment `reports` counters
- order reports are stored directly on the `orders` row as JSON text blobs plus report status metadata

## Admin-side moderation surfaces

### Main admin routes

- `GET /api/reports/googs`
- `GET /api/reports/goog-comments`
- `GET /api/reports/orders`
- `GET /api/reports/product-comments`
- `GET /api/reports/profiles`
- `GET /api/reports/ads`
- `PATCH /api/reports/googs/:id`
- `DELETE /api/reports/goog-comments/:id`
- `DELETE /api/reports/product-comments/:id`

### Operational behavior

The admin reporting layer is mostly a read/aggregate layer:

1. load report rows
2. join reporter identity
3. join owner identity
4. join target content
5. sort newest or highest-report-count first

For comment reports, admin routes aggregate the list of reporters into JSON arrays.

For product/ad reports, the admin layer merges:

- `market_reports` as `report_type = 'product'`
- `ad_reports` as `report_type = 'ad'`

## Order report resolution

Order reports are more interactive than other report types.

The order flow allows statuses such as:

- `pending`
- `accepted`
- `rejected`
- `reshipped`

Special cases in order update logic:

- buyer can accept a seller report
- opposite party can reject some reports
- seller can mark buyer report as `reshipped`

So order reports are not just moderation notes.
They actively affect order-resolution workflow.

## 5. Reach Tiers, Allowed Countries, and Ad Policy Operations

## Allowed countries

### Main routes

- `GET /api/admin/customization/ad-allowed-countries`
- `POST /api/admin/customization/ad-allowed-countries`
- `PUT /api/admin/customization/ad-allowed-countries`

### Main table

- `admin_customization_settings`
  - key used: `ad_allowed_countries`

### Structure

Allowed countries are normalized into 3 campaign buckets:

- `photo_video`
- `product_promote`
- `profile_promote`

The main app keeps a local copy and also proxies writes to the admin panel service.
So this feature is shared and synchronized across both backend surfaces.

## Reach settings

### Main routes

- `GET /api/admin/customization/reach-settings/public`
- `POST /api/admin/customization/reach-settings`

### Main table

- `reach_settings`

This is the legacy flat multiplier table.
It stores min and max multipliers per ad type:

- `photo_video_ad`
- `product_promote_ad`
- `profile_promote_ad`

## Reach tiers

### Main routes

- `GET /api/admin/customization/reach-tiers/public`
- `GET /api/admin/customization/reach-tiers`
- `POST /api/admin/customization/reach-tiers`
- `PUT /api/admin/customization/reach-tiers/:id`
- `DELETE /api/admin/customization/reach-tiers/:id`

### Main table

- `reach_tiers`

Fields define a budget band and duration band:

- `budget_from`
- `budget_to`
- `min_days`
- `max_days`
- `min_multiplier`
- `max_multiplier`
- `max_reach_multiplier`

### Operational effect on ads

Tier updates can directly sync onto live ads:

- ensure `ads.max_reach_cap`
- ensure `ads.current_reach`
- ensure `ads.completed_at`
- mark ads as `Completed` once impressions reach cap

So this is not just a configuration table.
It is operational policy that can mutate ad lifecycle behavior after admins change settings.

## Promo/reach connection

Promo code logic also reads `reach_tiers`, so promotion policy, budget bands, and reach math are coupled.

## 6. Public Share Pages and Reseller Attribution

## Public share routes

The system exposes multiple share entry shapes:

- `/product/[shareCode]`
- `/product/[shareCode]/[resellerRef]`
- `/share/[shareCode]`
- `/share/[shareCode]/[resellerRef]`
- `/share/product/[shareCode]`
- `/share/product/[shareCode]/[resellerRef]`
- `/share/ad/[adId]`
- `/share/goog/[postId]`

API lookup routes include:

- `GET /api/market/product/public/:shareCode`
- `GET /api/market/product/:shareCode`
- `GET /api/market/share-unified/:shareCode`

## Canonical share code behavior

Products and googs can have canonical share codes plus alias tables:

- `product_share_aliases`
- `goog_share_aliases`

The lookup logic can resolve:

- canonical product code
- short derived code
- legacy alias
- linked ad draft references

So old share links can continue working even if canonical storage changes.

## Share counting

Share counters are deduped by user or IP depending on whether the viewer is authenticated.

Tables used:

- `market_shares`
- `goog_shares`
- `goog_share_logs`
- `ad_shares`

When no prior share exists for that user/IP pair, the system increments:

- `market.shares_count`
- `goog_posts.shares_count`
- `ads.shares_count`

## Reseller attribution path

The sensitive part is not the public page itself.
It is the carry-forward of `resellerRef`.

### Attribution chain

1. user lands on reseller share URL
2. frontend keeps reseller attribution
3. cart item stores:
   - `reseller_ref`
   - `resell_commission_percentage`
4. order creation receives `reseller_ref`
5. order logic resolves reseller user
6. resell commission hold is created
7. final settlement later splits:
   - reseller share
   - Googer share

### Tables and fields

- `cart_items.reseller_ref`
- `orders.reseller_ref`
- `orders.reseller_user_id`
- `orders.resell_commission_percentage`
- `orders.resell_commission_amount`
- `orders.resell_googer_commission_percentage`
- `orders.resell_commission_transfer_id`
- `wallet_transfers` with:
  - `resell_commission`
  - `resell_googer_fee`

### Important truth

Share attribution is not only analytics.
It is a commerce input that can change who earns resell commission.

## 7. Followers, Following, and Blocked-User Graph

## Following / followers

### Main routes

- `GET /api/auth/user/:id/followers`
- `GET /api/auth/user/:id/following`
- `POST /api/auth/user/:id/subscribe`

### Main table

- `user_subscriptions`
  - `subscriber_id`
  - `subscribed_to_id`

### Logic

The follow action is implemented as subscription toggle:

1. if pair exists, delete it
2. otherwise insert it
3. return updated follower count

The API currently checks target existence, but the shown toggle path does not enforce the profile privacy field `who_can_follow_me` before inserting.

So:

- schema supports follow-privacy preference
- current toggle path appears simpler than that preference suggests

## Blocked users

### Main routes

- `GET /api/auth/user/:id/blocked`
- `POST /api/auth/user/:id/block`
- chat-level block/unblock logic also exists in chat controller

### Main table

- `user_blocks`
  - `blocker_id`
  - `blocked_user_id`

### Main effects

Block relationships affect more than profile visibility:

- user search filters out blocked users in wallet search flows
- market recommendation logic can exclude blocked sellers
- chat block path:
  - inserts into `user_blocks`
  - marks past chat messages deleted for blocker
  - deletes call records
  - hides conversation using `chat_presence.hidden_participants`

So the block graph is not a cosmetic social feature.
It affects search, market personalization, and chat history visibility.

## 8. P2P Buy/Sell Proof-Lock Lifecycle

Googer has two mirrored P2P systems:

- `p2p-ads` using:
  - `p2p_buy_ads`
  - `p2p_active_buyers`
  - `p2p_transactions`
- `p2p-sell-ads` using:
  - `p2p_sell_ads`
  - `p2p_sell_active_buyers`
  - `p2p_sell_transactions`

Both systems also emit lock events through in-process `EventEmitter` streams and an SSE `/events` endpoint.

## Shared lifecycle stages

1. ad created
2. ad may be temporarily locked by an active buyer
3. buyer starts pending transaction
4. funds move from wallet balance into hold
5. transaction row created with `status='pending'`
6. buyer or seller submits proof/details
7. counterparty confirms or cancels
8. hold is released to the correct wallet or returned
9. lock row is removed
10. SSE lock state is updated

## P2P buy-ads flow

Interpretation:

- seller is the ad owner
- buyer wants to acquire the seller's asset
- the held amount is generally based on `receive_amount`

### Key routes

- `POST /api/p2p-ads/:id/start`
- `POST /api/p2p-ads/transactions/:transactionId/submit-details`
- `POST /api/p2p-ads/transactions/:transactionId/confirm`
- `POST /api/p2p-ads/transactions/:transactionId/cancel`
- `POST /api/p2p-ads/transactions/:transactionId/report`

### Hold logic

In buy-ads flow, seller funds are held:

- seller `wallet_balance` decreases
- seller `hold_balance` increases

### Resolution

- confirm:
  - seller hold decreases
  - buyer wallet increases
- cancel:
  - seller hold decreases
  - seller wallet increases back

### Proof

Buyer can submit:

- `tx_id`
- `screenshot_data`
- `screenshot_name`

## P2P sell-ads flow

Interpretation:

- buyer is spending Googer wallet balance in `R`
- buyer receives foreign currency / external settlement

### Key routes

- `POST /api/p2p-sell-ads/:id/start`
- `POST /api/p2p-sell-ads/transactions/:transactionId/submit-details`
- `POST /api/p2p-sell-ads/transactions/:transactionId/confirm`
- `POST /api/p2p-sell-ads/transactions/:transactionId/cancel`
- `POST /api/p2p-sell-ads/transactions/:transactionId/report`

### Hold logic

In sell-ads flow, buyer funds are held:

- buyer `wallet_balance` decreases
- buyer `hold_balance` increases

The transaction stores:

- `amount`
- `receive_amount`
- `receive_currency`
- `buyer_fields`

### Resolution

- confirm:
  - buyer hold decreases
  - seller wallet increases
- cancel:
  - buyer hold decreases
  - buyer wallet is restored

### Proof direction

In the shown submit-details path for sell-ads, the route updates rows where `seller_id = caller`.
So the proof-submission responsibility is not perfectly symmetrical with buy-ads and must be treated carefully during UI or API changes.

## Lock behavior and cleanup

Both P2P systems:

- maintain an active buyer lock table
- remove stale locks older than `25 seconds`
- remove locks after confirm/cancel
- push lock changes through SSE

The route code also explicitly disables old DB auto-cancel trigger behavior so cancellation now depends on application-controlled actions rather than background DB triggers.

## Reports inside P2P

Each P2P transaction can store separate report reasons and timestamps for both sides:

- buyer report fields
- seller report fields

So P2P moderation is embedded directly inside the transaction rows, not in a detached generic report table.

## 9. Documentation completion status

The six previously remaining feature gaps are now covered.

That means the current documentation set now covers the major currently identified features in:

- social
- content
- ads
- shop
- wallet
- referrals
- resell
- subscriptions
- moderation
- P2P
- admin operations

## 10. Honest final note

Documentation can never stay complete by itself.

It is complete for the currently identified codebase features as of `2026-06-17`.
If flows change later, these docs must be updated with the code.
