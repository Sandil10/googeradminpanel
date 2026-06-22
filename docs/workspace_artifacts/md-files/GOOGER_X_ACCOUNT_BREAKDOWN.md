# Googer X-Account Breakdown

Status: live current-state pooled commission breakdown
Date: 2026-06-17
Live query basis: PostgreSQL queried on 2026-06-17

## Purpose

This file explains:

- what the Googer X-account is
- current live amount
- how many commission-carrying rows currently feed it
- which flows increase it
- which flows reduce it
- which admin user is currently the canonical receiver in code

## 1. What X Means

X = Googer main pooled balance.

It is not one ordinary admin wallet balance field.

Current formula:

```sql
SELECT COALESCE(SUM(commission),0)
FROM wallet_transfers
WHERE status='accepted';
```

## 2. Current Live X Amount

Current live result:

```text
21404.15
```

## 3. How Many Commission Rows Currently Feed X

Live accepted rows where `commission <> 0`:

```text
407 rows
```

Gross summary:

- gross positive commission = `51408.90`
- gross negative commission = `-30004.75`
- net pooled balance = `21404.15`

So X currently exists because:

```text
51408.90 in
-30004.75 out
=21404.15 net
```

## 4. Current Canonical Googer Receiver in Code

The main app resolves the Googer receiver like this:

1. `GOOGER_MAIN_USER_ID` env override if set
2. otherwise first `admin` user by `id ASC`
3. otherwise username fallback

Current live resolved admin:

- internal `id`: `7`
- readable `user_id`: `989735`
- username: `admin`
- full name: `Googer Support`

Important:

- most Googer commission inflows currently point to receiver `id = 7`
- but the pooled X-account is still a formula over accepted commission rows, not just `users.wallet_balance`

## 5. Gross Receiver Picture

Accepted commission rows grouped by receiver currently look like:

| receiver_id | net commission | rows |
|---|---:|---:|
| 7 | 50904.90 | 380 |
| 5 | 192.00 | 10 |
| 12 | -4.00 | 4 |
| 4 | -2298.75 | 2 |
| 13 | -7390.00 | 9 |
| 22 | -20000.00 | 2 |

This shows that receiver `7` is the main historical Googer intake target.

## 6. Positive Inputs to X

Live accepted commission rows by raw type:

| type | commission sum | rows |
|---|---:|---:|
| `transfer` | 39213.00 | 109 |
| `system_topup` | 10000.00 | 1 |
| `referral_commission` | 778.05 | 62 |
| `profile_promote` | 500.00 | 1 |
| `withdrawal_hold` | 340.00 | 6 |
| `sub_auto_renew` | 225.00 | 141 |
| `sell` | 200.00 | 2 |
| `commission_hold` | 90.85 | 18 |
| `subscription_payment` | 57.00 | 34 |
| `resell_googer_fee` | 5.00 | 5 |

## 7. More Useful Business Buckets

These are the current business-level meanings of X inflows:

| business bucket | net commission |
|---|---:|
| ad promote | 39213.00 |
| system topup to Googer | 10000.00 |
| referral commission other | 774.00 |
| profile promote | 500.00 |
| withdrawal hold | 340.00 |
| subscriptions | 282.00 |
| sell discount related | 200.00 |
| order commission hold | 65.85 |
| product commission | 25.00 |
| resell Googer fee | 5.00 |
| ad coin Googer via referral commission | 4.05 |

## 8. What These Positive Inputs Mean

### A. Ad promote

This is the biggest current sensitive money path.

Typical rows look like:

- `Ad Promote - ... - Photo Promote`
- `Ad Promote - ... - Product Promote`
- `Ad Promote Update - ...`

These are mostly recorded as accepted `transfer` rows with positive `commission`.

### B. System topup

This is admin capital moved into the Googer pooled side.

Typical row:

- `Admin Capital Transfer to Main Googer Balance`

Current live contribution:

```text
10000.00
```

### C. Referral commission

These include:

- normal referral distribution rows
- some ad coin related Googer referral-style rows

### D. Profile promote

This is a direct accepted `profile_promote` finance row.

Current live contribution:

```text
500.00
```

### E. Withdrawal hold

These are Googer-side accepted hold rows related to user withdrawal handling.

Current live contribution:

```text
340.00
```

### F. Subscriptions

These come from:

- `subscription_payment`
- `sub_auto_renew`

Combined current contribution:

```text
282.00
```

### G. Order settlement and resell

These come from:

- `commission_hold`
- `resell_googer_fee`
- some product/referral-linked discount logic

## 9. Negative Reductions to X

The pooled balance is not only increased.
It is also reduced by accepted negative commission rows.

Current largest reducers:

| type | net commission |
|---|---:|
| `system_payout` | -20304.00 |
| `ad_refund` | -9688.75 |
| `ad_coin` | -12.00 |

### A. `system_payout`

This is the route where pooled Googer balance is paid out to an admin wallet.

Current route:

- `POST /api/admin/transfer-googer-to-admin`

How it works:

1. check pooled balance using `SUM(commission)`
2. add amount to chosen admin `users.wallet_balance`
3. insert accepted negative `system_payout` commission row
4. pooled balance decreases

### B. `ad_refund`

When ad budget is refunded, the pooled X-account is reduced by negative accepted commission rows.

### C. `ad_coin`

There are direct ad-coin rows with negative commission values, which is why raw `wallet_transfers` alone can be misleading for ad-coin reporting.

## 10. Ad Coin Special Note

Live totals checked:

- `SUM(ad_coin_collections.commission)` = `6.50`
- `SUM(wallet_transfers.commission WHERE type='ad_coin')` = `-12.00`

So:

- ad coin business reporting should prefer `ad_coin_collections`
- the pooled X-account formula still uses `wallet_transfers.commission`

## 11. Examples of Current High-Value X Inflow Notes

Some of the largest current note-level contributors are:

- `Admin Capital Transfer to Main Googer Balance` = `10000.00`
- `Ad Promote - 8549672146 - Photo Promote` = `2000.00`
- repeated `Ad Promote - 7472578387 - Photo Promote` groups = `1500.00`
- repeated `Ad Promote - 7389463196 - Photo Promote` groups = `1500.00`
- several `Ad Promote - ...` rows at `1000.00`
- `Ad Hold Summary - Profile Promotion - Ad ID: 2322409234 ...` = `500.00`

## 12. Why X Is Sensitive

Because X currently controls a pooled business-money reserve that can be changed by:

- ad purchase rows
- ad refund rows
- subscription charges
- withdrawal handling
- referral/discount commission logic
- admin capital transfer to Googer
- admin payout out of Googer

That means X is one of the most sensitive finance values in the whole system.

## 13. Final Truth

The clean honest summary is:

- X currently = `21404.15`
- it is built from `407` accepted commission-carrying rows
- gross in = `51408.90`
- gross out = `-30004.75`
- the strongest current source is ad promote money
- the strongest current drain is admin payout plus ad refunds
- the main current receiver in code is admin user `id 7`, but X itself is still a pooled formula, not a normal wallet field
