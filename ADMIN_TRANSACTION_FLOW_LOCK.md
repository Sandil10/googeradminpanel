# Admin Transaction Flow Lock

These production flows are approved and locked:

- Wallet transfer sell and buy flows
- Product discount and product referral commission flows
- Ad collect coin and ad referral commission flows
- Googer main balance commission transaction logic

Do not change any transaction, balance, commission, payout, wallet, product, or ad flow logic unless the user gives explicit permission for that exact flow.

Admin panel display-only changes are allowed only when specifically requested. Display changes must not alter transaction rows, wallet balances, payout rows, or Googer main balance calculations.

Current admin-only display changes:

- Referral Control Total Commission card shows the total configured active Pro / Wallet commission from all admin commission levels.
- Referral Mapping hides system Buyer level `99` from the mapping list, while keeping level `99` available in Commission Control settings.
- Referral Mapping calculates display depth live from referral relationships so stale stored level values do not hide users from the correct level.
