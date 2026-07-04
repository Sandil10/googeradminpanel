# Main And Admin Hybrid API Ownership

This file exists so the admin panel has the same architecture reference as the main Googer backend work.

## Current Recommended Model

The correct current architecture for Googer is:

- `googernew-main` backend is the main business backend
- `googeradminpanel` is an admin-facing client and operational surface
- both clients should depend on stable backend APIs

This means the admin panel should avoid growing hidden duplicate business logic.

## Current Proxy Entry Points

Admin panel request forwarding currently lives in:

- [app/api/[...path]/route.ts](C:/Users/Administrator/Documents/new/googeradminpanel/app/api/[...path]/route.ts)
- [app/googer-api/[...path]/route.ts](C:/Users/Administrator/Documents/new/googeradminpanel/app/googer-api/[...path]/route.ts)

That proxy pattern is good for the current hybrid stage because it keeps browser traffic stable while backend ownership becomes cleaner.

## Domain Ownership Direction

Best ownership direction:

- `auth/user` domain -> backend service ownership
- `subscriptions` domain -> backend service ownership
- `wallet/referral` domain -> backend service ownership
- admin UI -> operational actions over APIs

## What Admin Should Not Become

The admin panel should not become:

- a second independent source of domain rules
- a separate hidden wallet engine
- a duplicate subscription engine

It should stay:

- a management client
- a reporting/operations client
- an API-driven administrative interface

## Current Migration Meaning

When backend module boundaries improve in the main backend, the admin panel becomes safer automatically because:

- fewer direct logic duplicates are needed
- route contracts are clearer
- future service extraction becomes easier

## Next Admin-Side Focus

1. keep admin services calling stable backend endpoints
2. avoid adding new domain logic directly in admin routes unless it is admin-only orchestration
3. move heavy domain rules to backend modules/services first
