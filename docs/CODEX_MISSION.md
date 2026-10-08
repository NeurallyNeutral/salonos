# Engineering mission: build a complete pilot-ready SalonOS, not another prototype

## Success definition
One owner can configure a service business, publish a booking URL, receive a booking, see it on another device, edit availability without founder involvement, mark attendance and paid amount, award merchant-funded loyalty credit, and send eligible post-visit confirmation/review/rebooking messages. Two tenants never see or affect each other's data. Critical operations survive restart and concurrency. Failures surface with actionable logs. A deterministic end-to-end demo operates with mock WhatsApp and email adapters without cloud accounts. Statuses must clearly distinguish bookings, attended visits, merchant-reported payments, delivered communications and customer acquisition.

## Milestones (do them sequentially; keep going until complete or genuinely blocked)

### M0 — Foundation and migration
- Use Cloudflare Workers + Hono + TypeScript + D1, static assets, no Node-only APIs at runtime.
- Inspect `reference/worker_scaffold` and `reference/interactive_demo` and selectively migrate safe code and styling.
- Implement single shared API, UI and D1. Establish migrations, seed fixtures, lint/typecheck, CI, Worker integration tests, browser E2E tests and `npm run demo` or equivalent.
- Write a migration roadmap; avoid keeping two competing backends.

### M1 — Secure multi-tenant business core
- Merchant setup with verified email sign-in (magic link, short TTL, one-time consumption, secure HttpOnly SameSite cookie session, CSRF protection). Local test email sink for dev.
- Admin bootstrap is out-of-band, requires authenticated operator; no open registration of tenants; audit changes.
- CRUD: brand/logo optional, services (duration/price), resources/staff, recurring hours, closure dates, booking cutoff/horizon, emergency pause.
- Enforce tenant scope on all routes, data reads, CSV exports and mutations. Server-side authorization; role model owner vs staff if needed.
- Status: invite flow or fixture onboarding works without credentials; no customer PII leakage.

### M2 — Booking that cannot overbook
- Accurate slots from tenant timezone, opening hours, staff/resource assignment, service duration and buffer, existing claims, break/blackout rules and booking horizon.
- Atomic DB-backed resource occupancy claims on 5-min cells, `UNIQUE(tenant_id,resource_id,slot_utc)` or stronger design. One D1 transaction per booking/reschedule that inserts all claims and record together or rolls back. Think through partial claim rollback, cancellation releases, staff selection and multi-duration overlaps.
- 20–40 parallel contenders for one slot: exactly one succeeds, others get stable 409; retry with same idempotency key returns same booking.
- Merchant can enter/edit offline/WhatsApp appointments into the same calendar; offline entries reserve real capacity.
- Customer self-cancel/reschedule via strong hashed token, bounded lifetime if sensible, no account. Rotate token on sensitive changes.
- Signed/localized time representations; invalid, past, out-of-hours, ambiguous DST, resource unauthorized values rejected.

### M3 — Delivery and operational reliability
- D1-persisted notification outbox. Confirmation/24h/2h/review/rebooking jobs tied to booking/payment changes with idempotency keys.
- Per-tenant messaging configuration, consent and unsubscribe/suppression. Email via Resend adapter and WhatsApp via Meta Cloud API adapter. Local fake providers record deliveries deterministically.
- Real webhooks with proper verification/HMAC, replay-safe processing and delivery receipt state machine; retry/backoff, rate limits, DLQ-like failed state and operator alerts. No false 'sent' timestamp before provider acceptance.
- Control for merchant scheduled notification preferences. Disable all marketing-type messages by default until explicitly authorized.
- Provider errors cannot crash booking transactions; messages recover when provider returns.

### M4 — Merchant workflows and metrics
- Mobile-first French-first storefront and merchant dashboard: calendar/day/week, service management, manual bookings, bookings and attendance status, outages/pause, source tags, export CSV.
- One source of truth; no localStorage-based fake state, except harmless preferences.
- Show: processed bookings, completed visits, no-show rate (with denominator), merchant-reported gross collected vs booked value, repeat customers, loyalty issued/redeemed and delivery outcomes. Never assert causation from booking traffic.
- Accessibility labels, keyboard nav, loading/empty/error cases, phone-sized e2e screenshots.

### M5 — Loyalty + reviews (required pilot value add, but after safe core)
- Merchant-toggleable earn rate in basis points: 100 or 200 bps (1%/2%). Store balances in integer centimes, append-only `loyalty_ledger` with per-tenant/customer lineage.
- After merchant records a completed visit + **payment**: one idempotent grant based on eligible amount. Refund/void generates reversal events; no update of old ledger rows. Restrict merchant-initiated manual adjustments and audit them. Redemption cannot exceed balance and merchant must confirm customer authority (OTP/token or in-person verified flow). Merchant credit reduces next eligible invoice at that business only.
- No cross-merchant credit, no cash-out, no transfer, no interest, no guaranteed redemption; document expiry/redemption policies as configurable and not silently arbitrary. Check local legal treatment before real launch.
- Completion-triggered neutral Google review prompt to **all eligible first-time customers** as a default policy; optional every-N-visits policy but never filter by satisfaction. No points/discounts for reviews, positive-only gating, or requesting specific star ratings. Use merchant's actual Google review link. Respect marketing/utility template classifications/consents.

### M6 — Ops, QA and demonstration
- CI: typecheck, unit, DB/Worker integration, browser E2E, adversarial tests. Seed at least two tenants and repeatable realistic test data.
- Time Travel recovery runbook; periodic export if required; secrets rotation and retention/export/delete flows; security headers, basic rate limiting and abuse controls.
- One-command local end-to-end demo, documented test accounts and fake message inbox. Docker/VM must NOT be mandatory for local developer use.
- Pilot-release checklist: all P0 tests green, data-protection review pending or approved recorded honestly, real WhatsApp and real email status explicitly labeled, no unauthorized public admin routes.

## External dependencies, not engineering excuses
Meta approval, real WhatsApp number onboarding, sender email/domain verification, Cloudflare production D1 creation, commercial payments, legal/privacy approval. Complete mock adapters, configuration, test harness and runbooks without requiring those accounts. Never claim live delivery works until it's actually tested.

## Deliverables
Working source, all migrations, tests, setup docs, launch/rollback runbooks, architecture decision records, sample data, annotated E2E walkthrough, `docs/PROGRESS.md` including exact passed/failed/blocked counts and evidence, and a release checklist. Create a PR for substantive work if a remote repo is available; no fake green status.
