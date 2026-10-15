# SalonOS V2 — Launch Kit product charter
Status: approved engineering direction, not a production release. Updated 2026-10-15.

## Strategic shift
Sell a repeatable Instagram-first business launch + conversion + retention operating layer, NOT custom websites or individually managed automation contracts. Buyer: newly opened or recently active Moroccan microbusinesses, starting with service providers/beauty studios and Instagram storefronts. Newness/follower count are discovery signals, not proofs of sales volume. Do not claim software generates demand from nothing.

**North star:** a merchant can configure, publish, operate and pay for a standard storefront without founder involvement. Target median merchant setup <= 10 minutes, measured in user tests; record any step requiring founder intervention. No per-merchant code, infrastructure, theme fork, custom automation or developer login.

## One multi-tenant platform, two storefront modes
1. `appointments` — salons, lashes, nails, piercing, spa, coaches: service catalog, prices/duration, staff/resources, availability, booking, manual booking, cancel/reschedule, notifications, completed attendance and merchant-confirmed payment.
2. `catalog_inquiry` — fashion, products, small retailers: product/variant showcase, availability inquiry / request/order-intent, click-to-chat or lead capture, fulfillment status manually recorded. No invented inventory sync, delivery integration, payment processing or checkout promise.

Both share merchant identity/branding, welcome page, custom branded content, public policy/contact, lead/customer records, source attribution, consent, loyalty ledger tied only to confirmed payments, neutral first-visit Google review prompts where eligible, configurable communication channels, permissions, health and privacy workflows.

## New merchant lifecycle — self-serve, atomic and resumable
1. Verified merchant email creates provisional tenant.
2. Choose vertical/template and business display name (with slug collision/impersonation controls).
3. Add 1–5 services OR 1–5 catalog items; CSV optional later; preset suggestions editable.
4. Configure business hours/resources if appointments; contact/location/WhatsApp link if either; real address optional.
5. Pick palette and upload merchant-owned logo/images (copyright/size/type checks); good defaults.
6. Add genuine Google review URL if merchant has one; enable optional 1%/2% merchant-funded loyalty only after understanding terms.
7. Review preview with visible unpublished status; confirm and publish; show ready-to-copy Instagram bio URL and QR.
8. Messaging: default customer-initiated wa.me contact link, no Meta API authorization required. Official Meta Cloud API automatic sends become OPTIONAL after explicit merchant connection, approved templates, billing and consent. Email can be enabled separately. If not connected, UI must say reminders are off; never fake delivery.
9. Merchant can edit/pause/unpublish/export/delete without founder support.

## Sales / evaluation demo
- One professional polished example of each vertical, with synthetic customers and explicit DEMO labeling.
- Safe shareable personalized prospect preview from merchant-provided or authorized business data; NOT an impersonating live site or unlicensed scraped logos/photos.
- Customer flow -> merchant flow should be understandable in <90 seconds, tested on actual phone screens.
- Separate real platform from demo fixtures; prospects never create real bookings in fake demo.

## Measurement
Instrument tenant created -> onboarding completed -> first publish -> first real inquiry/booking -> first completed visit -> merchant-confirmed payment -> repeat visit, plus setup time and support intervention. Distinguish processed bookings, leads, merchant-reported revenue, independently verified payments and attributable new customers. Never label all website visitors 'acquired'.
Track product health per tenant and per feature, support minutes/merchant/month, active merchants, churn, successful bookings, delivery error rates.

## Pricing — not hardcoded
Offer hypothesis: modest setup or setup-free trial, low entry base subscription with fair usage pass-through for third-party messaging, and optional higher plan. Performance commission remains experimental until attributable VERIFIED payments and clear disputes/terms exist. Loyalty 1%/2% is merchant-funded customer credit, NOT SalonOS platform fee. Billing system must support configurable plans/quotas/usage with disabled external collection until chosen and owner-approved. No silent cost assumptions.

## Technology / constraints
Keep current Cloudflare Workers + Hono + D1 backend, tenant-scoped auth, atomic booking claims, provider adapters and append-only loyalty. Expand via small migrations and feature flags; preserve V1. Avoid introducing Node/Redis/Postgres/Next.js as an operational dependency. Add images only via compliant object storage and signed uploads; define cost/abuse limits. Maintain reproducible local real-D1 tests. No live deployment, no Vercel invocations or GitHub workflow triggering Vercel. Owner alone controls Vercel releases. Paid/provisioned Cloudflare and third-party resources require owner approval.

## Explicitly deferred
Full e-commerce checkout, shipping integrations, AI receptionist, autoposting, marketing broadcasts, scraping Instagram, price-optimization AI, custom merchant websites, referral marketplace, POS sync, native mobile app, multi-branch chains. Revisit only after customer evidence.

## Acceptance gates
- V1 tests stay green; no tenant leaks or privilege regression.
- Different business modes work independently under tenant auth. Cross-tenant IDs/data cannot be accessed.
- Provisioning and publication are transactional/idempotent and rate-limited; slug conflict and forbidden markup rejected; malicious uploads rejected.
- 5 independent first-time test merchants reach publish without engineer intervention; record median time and exact blockages.
- Onboarding resumes after crash/navigation; defaults cannot send WhatsApp messages before authorization.
- Site with only `wa.me` link works without Meta access; all connected integrations degrade gracefully.
- All events, metrics and revenue distinctions are truthful. Synthetic demo cannot contaminate analytics.
- Financial ledger exact integer math remains intact and cannot issue credit on incomplete/unpaid transactions.
- Mobile and accessibility E2E, API/CI, backup/recovery and no-live-provider mocks pass.
