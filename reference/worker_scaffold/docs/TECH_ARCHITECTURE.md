# Technical architecture

## Why Cloudflare instead of Oracle

The requirement is not “free server.” It is “almost no work after setup.” A VM creates patching, process supervision, certificate renewal, disk monitoring, backups, failover and security maintenance. Cloudflare Workers + D1 remove most of that operational surface.

The free tier is large enough for early validation; upgrade cost is trivial once subscriptions exist.

## Components

### Edge application
- Cloudflare Worker
- Hono router
- TypeScript
- SSR/simple HTML for merchant pages
- small progressive JS for availability selection

### Data
D1 tables:
- tenants
- merchant_users
- magic_links
- services
- resources
- weekly_hours
- blackouts
- bookings
- reminder_jobs
- event_log

### Reminder engine
A single Cron Trigger runs every 15 minutes:
1. query confirmed bookings whose 24h or 2h reminder falls inside current window;
2. write idempotency record before/around send;
3. send WhatsApp utility template when configured;
4. send email fallback/confirmation as configured;
5. record provider response.

One cron serves every tenant.

### Tenant isolation
Every tenant-owned row contains tenant_id. All merchant routes derive tenant_id from the authenticated session, not request parameters alone. Public booking uses merchant slug -> tenant_id lookup.

### Secrets
- app secrets stored in Workers secrets
- per-merchant Meta tokens should be encrypted at rest with an application key before D1 storage
- never expose provider tokens to browser code

### Auth
Merchant: email magic link. No passwords to reset.
Customer: no account. Booking-management links use a random high-entropy token stored as a hash.

### Observability
- /health endpoint
- structured event_log
- provider response logging without message-body leakage
- aggregate daily counters
- later: error alert via email

### Backups
Use D1 Time Travel plus periodic export once paid customers exist.
