# GOOGER NEW FEATURES AND AI AGENT SCALABLE ARCHITECTURE

## Purpose

This document defines how all future Googer features must be added so the current architecture stays scalable, reliable, and safe.

It is especially important for:

- AI agent features
- automation features
- chat assistant features
- recommendation features
- wallet-connected features
- admin-triggered background features
- heavy public-read features

The rule is simple:

**new features must fit the scalable architecture, not bypass it**

## Current architecture direction

The project is already moving toward a safer architecture:

- sensitive finance logic is being centralized
- background work is moving out of request paths
- public reads are using short-lived caching
- admin and main system responsibilities are becoming clearer
- monitoring and load testing are now part of backend work

This means new features can still be added, but they must follow the same pattern.

## Core rule for every new feature

Before adding any new feature, check these:

1. Does it touch wallet, balance, commission, referral money, settlement, topup, payout, or admin pooled balance?
2. Does it add a new public endpoint with high traffic potential?
3. Does it do heavy DB work?
4. Does it trigger notifications, scoring, AI calls, moderation, or retries?
5. Does it need background execution?
6. Does it add new real-time traffic?

If the answer is yes to any of those, the feature must follow the architecture rules below.

## Mandatory architecture rules

### 1. Keep sensitive money logic inside the strict finance boundary

Never put wallet-changing logic directly inside random route handlers.

All new features involving:

- wallet transfer
- referral payout
- reseller payout
- commission allocation
- subscription settlement
- ad budget deduction
- admin X-account movement

must go through the same shared finance boundary and ledger-safe logic.

Required:

- idempotent transaction handling
- DB transaction around balance changes
- ledger/audit record for every balance mutation
- no duplicated wallet updates from retries
- no direct frontend trust for money values

### 2. No heavy work inside request/response path

Do not place these directly in live API requests if they can grow:

- AI generation
- AI moderation
- summarization
- ranking rebuild
- bulk notifications
- report review jobs
- recommendation rebuild
- analytics aggregation
- thumbnail/media processing
- email/SMS/push fanout

These must go to workers/queues.

Request path should only:

- validate
- save command/request
- enqueue job
- return status

### 3. Public high-traffic reads must be cache-first

Any new public-read feature must be designed with cache support from day one.

Examples:

- public AI suggestions
- public recommendations
- trending lists
- feed sections
- ad discovery blocks
- public profile summary cards
- home widgets

Required:

- short-lived response cache
- smaller response shape
- indexed DB reads
- anonymous/guest optimization
- pagination or slice limits

### 4. DB queries must be shaped for scale

Every new feature must avoid:

- large `SELECT *`
- repeated aggregate joins in hot paths
- per-row nested DB queries
- expensive recomputation in public endpoints
- scanning without indexes

Required:

- fetch only needed fields
- add indexes for filter/order columns
- use precomputed or cached aggregates when traffic is high
- separate write path from read model when needed

### 5. New AI agent features must be isolated as services/workflows

AI agent features must not be mixed directly into normal controller logic.

Recommended structure:

- route/controller accepts request
- feature service validates permissions and limits
- enqueue agent job
- worker executes AI task
- save result/status
- optional notification to user/admin

Good AI agent feature examples:

- AI content helper for Googs
- AI moderation assistant
- AI ad copy generator
- AI product description helper
- AI support/admin assistant
- AI fraud/risk review assistant

Bad pattern:

- route calls AI provider directly
- waits for long external completion
- updates wallet/admin state in same request
- no timeout/retry boundary

### 6. AI features need usage limits and cost controls

Any AI feature must define:

- who can use it
- daily/monthly quota
- paid vs free plan access
- timeout behavior
- retry policy
- fallback if provider fails
- audit logs for admin-sensitive actions

For paid AI features also define:

- how credits/coins are deducted
- when deduction happens
- when refund happens if job fails
- whether admin approval is needed

### 7. Real-time features must be designed carefully

If a new feature uses chat/socket/realtime updates:

- keep sockets lightweight
- do not attach heavy DB queries on every event
- do not depend on in-memory state only
- prepare for multi-instance delivery later

If AI agents or notifications need realtime updates:

- publish status changes from worker completion
- keep socket payload small
- persist final state in DB first

### 8. Admin-only heavy tools must still be isolated

Admin features often look safe because only admins use them, but they can still damage production performance.

New admin features must also avoid:

- expensive synchronous exports
- full-table scans in request path
- direct destructive finance changes without review
- background maintenance logic inside page load

Admin-triggered heavy actions should create jobs.

## Recommended architecture for new AI agent features

### AI content/helper agent

- route receives request
- validate plan/quota/auth
- store job row
- enqueue worker task
- worker calls AI provider
- store output/result
- optional moderation pass
- return status/result by polling or notification

### AI moderation agent

- content/ad/report enters review flow
- lightweight request saves pending state
- background moderation job runs
- result stored as recommendation, not silent destructive action
- admin can approve/reject on sensitive cases

### AI finance/risk agent

This is the most sensitive category.

Rules:

- AI may recommend, flag, summarize, or score
- AI must not directly move money
- final finance action must remain deterministic and rule-based
- admin override actions must be logged

## Feature categories and how they must be added

### Safe to add with normal backend pattern

- small profile features
- UI-only preferences
- low-volume admin settings
- non-financial metadata fields

### Add carefully with performance review

- new public feed blocks
- recommendation features
- public discovery/search features
- real-time counters
- social graph features
- notification-heavy features

### Add only through strict boundary

- wallet-related features
- referral/reseller payout features
- subscriptions and plan settlement
- ad budget and commission flows
- AI usage billing

## Required checklist before merging any new feature

For every new feature, answer:

1. Is the request path lightweight?
2. If heavy, is it moved to worker/queue?
3. If public-read, is there caching?
4. Are indexes added for new hot queries?
5. Does it touch money?
6. If yes, does it use shared finance boundary?
7. Does it create logs/audit records where needed?
8. Does it have rate limit/quota rules?
9. Does it have load-test coverage if traffic can be high?
10. Does it avoid breaking current business logic?

## Minimum technical standard for future features

Every major new feature should include:

- controller/service separation
- schema/index review
- worker path if heavy
- cache strategy if public
- monitoring point
- error handling and retry policy
- documentation update

## Best way to add upcoming features now

Recommended order:

1. define feature type
2. classify as public-read, money, realtime, admin, or AI
3. decide request path vs worker path
4. define cache/index needs
5. define audit/quota rules
6. implement with existing shared architecture
7. add/update load test if traffic-sensitive
8. update docs

## Final decision

Yes, new features can be added on top of the current architecture.

But for the architecture to remain scalable:

- AI agents must be added as isolated job-driven services
- money features must stay inside strict finance handling
- public-heavy features must be cache-aware
- no new feature should bypass worker/caching/ledger rules

If this document is followed, new features can be added without turning the system back into a fragile monolith.
