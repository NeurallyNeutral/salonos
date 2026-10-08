# Technical constraints and architecture decisions

## Stack
Cloudflare Worker/TypeScript/Hono/D1, small SSR or static frontend; no Oracle VM in first pilots. Select minimum other dependencies. Runtime provider adapters: `MailProvider`, `WhatsAppProvider`, `BillingProvider` (billing only later, configured off by default). Mock providers required for a self-contained end-to-end demo. Hono routes organized by `/public`, `/merchant`, `/admin`, `/webhooks`. Never ship debug reset routes in prod.

## Data and tenancy
Every tenant-owned record must include tenant ID and be constrained through API authorization. All cross-table associations must validate tenant equality server-side. Tenant-scoped unique indexes. Store UTC epoch (or stable ISO UTC) internally; merchant timezone is `Africa/Casablanca` by default; test offset changes and local-time parsing.

## Occupancy algorithm
To avoid the current SELECT-then-INSERT race, represent occupancy as per-resource, per-5-min slot claims in D1: key `(tenant_id, resource_id, utc_slot_start)` with UNIQUE. For a 20-minute service, claim four 5-min cells; buffers increase cells. In an atomic DB `batch()` or equivalent SQL transactional unit: insert booking, insert ALL claims, insert outbox events. Any unique failure must roll back **the entire** operation. Claim release + status change or reschedule reallocation must also be atomic. App must choose an eligible resource and validate every cell is bookable before commit, while DB uniqueness handles race. No partial claims. If adapting a different algorithm, provide a rigorous concurrency proof and test.

D1 `batch()` is transactional per Cloudflare documentation, but don't treat a SELECT followed by a separate INSERT call as atomic. Integration tests must use the actual local Worker+D1 environment, not just a mocked map.

## Example domain tables
`tenants`, `merchant_users`, `sessions`, `services`, `resources`, `service_resources`, `weekly_hours`, `blackouts`, `customers`, `bookings`, `booking_claims`, `booking_events`, `notification_outbox`, `notification_attempts`, `webhook_events`, `loyalty_accounts`, `loyalty_ledger`, `payment_records`, `reviews_prompt_events`, `tenant_provider_connections`, `audit_log`, `tenant_subscription_status`.

`customers` are scoped to a tenant and normalized E.164 mobile. No global sharing/marketing pool; appropriate privacy controls. Stored consent basis, channel and timestamp, avoid storing unnecessary messages.

## Secrets/auth/abuse
HMAC-verified Meta webhook raw payload. Store merchant access tokens encrypted server-side (AEAD with Worker secret KEK); rotate keys with versioning. Magic links: hashed single-use random tokens, TTL, email delivery, CSRF-safe state changes, secure cookies. Customer management links: long random tokens hashed at rest, scoped to exact booking, revocable. Rate limit by tenant/IP/phone for booking and login. Do not disclose email/phone existence from auth responses. Prevent spreadsheet/CSV injection by escaping leading formulas.

## Job semantics
Outbox unique event keys by tenant/event, stable message ID, states `pending`, `leased`, `provider_accepted`, `delivered`, `failed_retryable`, `failed_final`, `suppressed`; record reason/retry at, TTL expiration, attempts, provider IDs. Cron/queue worker should tolerate duplicate execution, backlog, outages. Delivery attempts should not leak PII in logs.

## Storage and availability
Use local Worker+D1 database for integration tests. Keep logs privacy-aware; minimum 7 day D1 Time Travel free-plan recovery window and verify paid-plan retention (current provider docs, may change). Write separate export/restore rehearsals and RTO/RPO targets based on actual customer tolerance.

## Reference source
The old reference Worker permits unauthenticated merchant viewing and runs a non-atomic slot check; the demo server exposes `/api/state`, `/api/reset` and unauthenticated status changes, returns static available slots and holds in-memory data. All unsafe routes are demo/reference only. The old browser UI has localStorage demo state and must be unified against the new API.
