# External integrations and launch blockers

## WhatsApp (Meta Business Platform)
- Use a provider adapter; `MockWhatsAppProvider` for local tests. Never use consumer WhatsApp scraping or unofficial browser automation.
- Real prerequisites: eligible Meta developer/business assets, WhatsApp Business Account/phone, correct permissions, app review/advanced access where required, approved templates, live send permission, billing/payer arrangement, customer opt-in/valid lawful basis.
- Explore merchant account and phone-number compatibility/coexistence; DO NOT assume connecting the Cloud API preserves their existing WhatsApp Business app workflow without testing.
- Verify webhook GET challenge and POST `X-Hub-Signature-256` with app secret. Deduplicate events. Store message IDs and actual statuses.
- Template categories: booking confirmations, reminders, loyalty or review messaging may be classified differently; verify current provider classifications, costs, window and allowed usage. No marketing messages by default. Test actual 2-way interaction only when necessary.
- Pilot go/no-go = observed accepted and delivered approved template on a real phone; consent and customer experience checked.

## Email (Resend)
Mock for local dev. For real use: owner-confirmed domain or subdomain, SPF/DKIM verification, API key in Worker secrets, rate limits, unsubscribe for promotional messages. `accepted` != `delivered`. Avoid emailing booking details without privacy safeguards.

## Cloudflare
A person must provision a real account, D1 database ID, Worker routes, secrets, domain, and select a production release. Local builds need no account. No production deployment without explicit user approval. Confirm D1 free/paid recovery limits and test restoration on non-production data before live launch.

## Merchant billing
Commercial model (subscription vs variable performance fee) remains undecided. Do not wire live payment collection. Add feature flags and invoices/mock financial states only if essential for admin. Record historical paid fees from real billing later and do not conflate customer payments with SalonOS invoices.

## Morocco personal data and client documents
External legal/regulatory review and correct notices/consent/retention, CNDP filings/transfers where applicable, merchant/controller agreements and access rights before live personal data. Keep test fixtures synthetic. No guarantee compliance without counsel/account-owner actions.

## Google review URL
Merchant must supply genuine Google review link. Any customer prompt neutral, no perks for posting. No star-rating gaming.
