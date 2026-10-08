# Pilot definition of done — executable tests required

The agent must implement tests that exercise a real locally running Worker/D1 and browser, not only mocked data structures. Record commands and output in `docs/PROGRESS.md`.

## P0: blocking tests
- Merchant login one-time magic link; expired, reused, forged and tampered tokens all fail; session cookies secure; csrf on mutations.
- Cross-tenant routes/foreign IDs/CSVs never leak names, phones or appointment details. Test both roles and guessable IDs.
- Exactly 1 successful booking when 40 simultaneous requests claim one 20-min slot/staff; others get 409. No orphan claims after rejection.
- Collision across varying durations and buffers, new online vs manual booking, reschedule into occupied time, cancellation releases capacity.
- Availability rejects closed hours, blackouts, past dates, service-resource mismatch, too-far future bookings; timezone conversions around Casablanca transitions.
- Booking idempotency: same key returns same booking, no duplicate outbox or loyalty entry.
- Wrong, expired or revoked customer management token cannot cancel/reschedule; reused sensitive token cannot alter a different booking.
- Bookings and merchant settings survive Worker restart; two tabs/devices agree after refresh; browser localStorage clearing does not erase business data.
- Notification processing handles provider downtime, retries, duplicate cron execution, replayed webhooks, partial failure and fallback without double messages or fake delivery success.
- Merchant can pause/unpause storefront and manually create bookings without founder access.
- PII never appears unauthenticated via `/api/state`, exported CSV, server logs, error stack traces or debug endpoints. Avoid unrestricted CORS.
- Basic abuse controls on booking/auth endpoints, rate limit/size constraints, output escaping and CSV injection protection.

## P1: product tests
- Mobile booking 360px wide, service -> slot -> name/phone -> confirmation; cancel and reschedule.
- Owner mobile dashboard & weekly calendar, create/edit services/hours/blackouts, attendance/no-show, money-reporting and CSV.
- First-time visit Google review requests sent neutrally to eligible recipients, including lower-rated/unhappy visits if app collects satisfaction. No reward-on-review.
- Loyalty earn 1%/2% on 120.00 MAD merchant-reported paid visit, exactly-once under retries, refund reversal, partial refund, cap/expiry, redemption requires authorization, tenant-specific balances, no floats.
- At least two merchant seed tenants, separate demo customers, neutral dummy phone/email, accessible mock inbox for WhatsApp/email.
- Analytics consistency: booked vs completed vs merchant-recorded payment vs repeat visit; no 'clients we acquired' claim solely from booking.
- Graceful provider-disabled booking with truthful notification status, retry administration and downtime display.
- Backup/restore runbook actually rehearsed on sample non-production D1, data retention and deletion/export policy documented.

## P2: readiness, manual external only
- Verified Meta Cloud API template accepted/delivered to test phone from a real merchant account, webhook signature validation observed.
- Domain/sender verified for email production and delivery observed.
- Privacy/CNDP review confirmed by responsible owner; customer consent shown.
- Production smoke test, rollback route and outage plan verified, user explicitly approved deployment.

**Only mark `PILOT_READY` once P0/P1 are green and required real-provider and privacy gates for chosen pilot are satisfied.** Local mocked `CODE_COMPLETE` is a different status.
