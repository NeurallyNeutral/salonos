# SalonOS MVP

A minimal multi-tenant booking, reminder, attendance and analytics layer for appointment-based local businesses.

## Product thesis

Do not sell websites. Sell appointment infrastructure: a branded booking link that captures bookings, reduces no-shows, records outcomes and produces proof of value with near-zero operator work after onboarding.

## Chosen commercial model

**Founder cohort (first 5 businesses):**
- Setup: 990 MAD one-time
- Subscription: 990 MAD/month
- Cancel any time after the first 60 days
- WhatsApp Business Platform charges, if enabled, are billed directly to the business's Meta account
- Permission to use anonymized metrics + testimonial is part of founder pricing

**Standard price after case studies:**
- Setup: 1,490 MAD
- Core: 1,490 MAD/month, up to 250 bookings/month
- Pro: 1,990 MAD/month, up to 750 bookings/month
- Multi-location/custom: from 2,990 MAD/month

Why subscription instead of pay-per-client: it eliminates attribution disputes, under-reporting incentives, revenue-verification work and variable invoices. The product still tracks booked/completed appointments and booked revenue for ROI reporting.

## Technical choice

Cloudflare-first, not Oracle VM, for the MVP. The zero-maintenance requirement dominates: Workers + D1 remove OS patching, server monitoring, backups scripting and capacity management. Oracle Free Tier remains an escape hatch if later workloads require a VM.

- Runtime/API: Cloudflare Workers + Hono + TypeScript
- Database: Cloudflare D1
- Static assets: Cloudflare Worker static assets
- Reminders: one global Cron Trigger polling upcoming bookings
- Email: Resend
- WhatsApp: Meta WhatsApp Business Platform Cloud API, direct account per merchant
- Authentication: passwordless email magic links for merchants
- Customer accounts: none; signed links for cancel/reschedule
- Payments: out of MVP; customer pays merchant directly
- Billing of merchants: manual/standing order initially; automate after first 5

## MVP boundaries

Included:
- Multi-tenant merchant setup
- Service catalog and prices
- Weekly opening hours + blackout dates
- Booking page
- Availability computation
- Confirmation email
- Optional WhatsApp confirmations/reminders
- 24h + 2h reminders
- Merchant dashboard
- Statuses: confirmed/completed/no-show/cancelled
- UTM/source tracking
- Basic ROI metrics
- CSV export
- Customer self-cancel/reschedule token

Deferred:
- Card deposits
- Marketplace/discovery
- AI chat agent
- Staff payroll
- Inventory
- POS
- Native mobile app
- Complex CRM campaigns
- Google Calendar two-way sync

## Run locally / deploy

1. Install dependencies: `npm install`
2. Create D1 database and apply `migrations/0001_init.sql`
3. Fill Wrangler D1 binding IDs in `wrangler.toml`
4. Add secrets:
   - `RESEND_API_KEY`
   - `MAGIC_LINK_SECRET`
   - optional `META_GRAPH_TOKEN`
5. `npm run dev`
6. `npm run deploy`

The code is a scaffold: core schema and route structure are present, but production hardening, auth completion and Meta embedded onboarding should be finished before live merchant usage.
