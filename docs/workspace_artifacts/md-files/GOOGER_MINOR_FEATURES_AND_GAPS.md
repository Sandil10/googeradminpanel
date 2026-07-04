# Googer Minor Features and Remaining Gaps

Status: current side-feature documentation pass
Date: 2026-06-17

## Purpose

This file documents the remaining smaller but still important features:

- admin OTP
- notifications
- promo codes
- suspension and appeal
- stickers

It also records what is still not deeply documented after this pass.

## 1. Admin OTP Flow

### Where it lives

- admin route: `googeradminpanel/routes/admin-otp.js`

### Current behavior

- in-memory OTP store using `Map`
- OTP is 6 digits
- phone is normalized by stripping non-digits
- OTP expires in 5 minutes
- background cleanup runs every 10 minutes
- SMS sending tries:
  1. Text.lk v3 API
  2. Text.lk HTTP fallback

### Routes

- `POST /api/admin/send-otp`
- `POST /api/admin/verify-otp`

### Important current characteristics

- OTP storage is in memory only
- server restart loses pending OTPs
- this is not a cross-instance shared OTP store
- route currently returns `debug_otp` in the success payload, which is highly sensitive

### Risk note

For production-grade finance protection, admin OTP should ideally move to:

- persistent OTP store or cache
- rate limiting per phone / admin / IP
- no `debug_otp` echo
- audit log of wallet-sensitive OTP use

## 2. Notifications Flow

### Main app notifications

Main route:

- `googernew-main/backend/src/routes/notifications.js`

Current table:

- `user_notifications`

Main user routes:

- `GET /api/notifications`
- `POST /api/notifications/read-all`
- `POST /api/notifications/:id/read`

Admin send route on main backend:

- `POST /api/notifications`

Behavior:

- lazy-creates `user_notifications` table
- stores unread/read user notifications
- supports styling fields:
  - `theme_color`
  - `theme_font_color`
  - `theme_font_size`
- only admin can send through the main backend route
- if no target ids are given, all users are targeted

### Admin panel notifications

Admin route:

- `googeradminpanel/routes/notifications.js`

Routes:

- `POST /api/notifications/send`
- `GET /api/notifications/all`

Behavior:

- also ensures `user_notifications` exists
- can send to:
  - specific `user_ids`
  - one `user_group`
  - all non-deleted users
- admin panel version uses explicit `/send`

### Documentation truth

Notifications are now documented, but they are still a side-system.
They are not a core money path unless future wallet/security notices depend on them.

## 3. Promo Codes Flow

### Main backend promo code path

Main route:

- `googernew-main/backend/src/routes/promoCodes.js`

Controller:

- `googernew-main/backend/src/controllers/promoCodesController.js`

User routes:

- `POST /api/promo-codes/validate`
- `POST /api/promo-codes/redeem`

### Current promo code model

Table:

- `promo_codes`

Important fields:

- `code`
- `ad_type`
- `discount_type`
- `discount_value`
- `reach_cap`
- `is_active`
- `max_uses`
- `uses_count`
- `expires_at`
- `min_reach_bonus`
- `max_reach_bonus`
- `promo_max_days`

### Business rules

- promo codes are ad-type-specific
- current ad types include:
  - `photo_video_ad`
  - `product_promote_ad`
  - `profile_promote_ad`
- validation checks:
  - code exists
  - active
  - not expired
  - within max uses
  - not already used by same user
- redeem path locks promo row with `FOR UPDATE`
- redeem increments `uses_count`
- redeem writes promo info back to the `ads` row

### Admin promo code management

Admin panel controller:

- `googeradminpanel/controllers/promoCodeController.js`

Admin routes:

- `GET /api/admin/customization/promo-codes`
- `POST /api/admin/customization/promo-codes`
- `PATCH /api/admin/customization/promo-codes/:id`
- `DELETE /api/admin/customization/promo-codes/:id`

### Important current note

Promo codes currently shape ad economics and reach behavior more than direct wallet balance movement.
So they are operationally important, but secondary to wallet/order settlement.

## 4. Suspension / Appeal / Self-Deactivate / Self-Delete

### Where it lives

Main auth routes:

- `GET /api/auth/suspension`
- `POST /api/auth/suspension/appeal`
- `POST /api/auth/self-deactivate`
- `POST /api/auth/self-delete`

Controller:

- `googernew-main/backend/src/controllers/authController.js`

### Current behavior

#### Get suspension

Returns the current user suspension/deactivation fields including:

- `is_deactivated`
- `deactivation_reason`
- `suspension_reason_category`
- `suspension_action`
- `suspension_days`
- `suspended_at`
- `suspension_ends_at`
- `appeal_*`
- `suspended_wallet_access`

#### Submit appeal

Validates:

- appeal text required
- max 2000 chars
- contact email required
- phone required
- agreement confirmed

Then:

- only allowed if account is deactivated
- blocks duplicate pending appeal
- generates unique `appeal_id`
- stores appeal metadata in `users`

#### Self-deactivate

Current behavior:

- pauses active ads first
- marks user deactivated
- status becomes `Deactivated`
- stores self-deactivation timestamps/reasons
- clears prior appeal state

#### Self-delete

Current behavior:

- pauses active ads first
- marks user deactivated
- status becomes `Deleted`
- stores self-delete timestamp/reason
- clears prior appeal state

### Why this matters

This is not only profile state.
It affects:

- public visibility
- ad lifecycle
- appeal workflow
- account recovery path
- potentially wallet-access interpretation

## 5. Stickers Flow

### Where it lives

- `googernew-main/backend/src/routes/stickers.js`

### Current behavior

- authenticated route only
- sticker source is Tenor API
- trending and search endpoints provided
- sticker access is gated by subscription features

Routes:

- `GET /api/stickers/trending`
- `GET /api/stickers/search?q=...`

### Business rule

If `chat_stickers` feature is not enabled for the user plan:

- route returns `403`
- current message says stickers require `Plan 02`

### Why this matters

Stickers are a side engagement feature, but they are tied to subscription entitlement, so they matter for plan-feature documentation.

## 6. What This Pass Closed

After this file, the following previously-light areas are now documented:

- admin OTP
- notifications
- promo codes
- suspension / appeal
- stickers

## 7. Follow-up Status

The feature gaps that were still open when this file was first written are now covered in:

- `GOOGER_REMAINING_FEATURES_DEEP_DIVE.md`

That follow-up doc closes:

- followers / following / blocked-user graph
- saved googs / saved ads behavior
- reports moderation workflow
- detailed P2P buy/sell lifecycle
- share attribution / caching details
- reach tiers / allowed countries / ad policy operations

## 8. Honest Final Answer

So after the later follow-up deep dive:

- the critical business and finance documentation is done
- the requested minor features are documented
- the previously remaining secondary-feature gaps are also documented

For the currently identified codebase features, the documentation pack is now complete as of `2026-06-17`.
