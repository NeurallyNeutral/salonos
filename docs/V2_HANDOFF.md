# V2 Launch Kit: local demonstration and owner release actions

Implementation branch: `codex/v2-launch-kit`. Review only; main and V1 PR #1 are not merged or modified. Final code/CI evidence is in [V2_PROGRESS](V2_PROGRESS.md). Live providers, five-human usability and pilot approval are separate gates.

## Run locally

Use Node 24 and npm. In this checkout run `npm ci`, then `npm run demo`. The server is `http://localhost:8787`. Stop with Ctrl+C. D1 and optional object assets persist in ignored `.wrangler/demo/`; app keys are generated locally. Never copy this synthetic database to a real merchant environment. Docker and cloud accounts are unnecessary.

Open `/shop/atelier-atlas` for the fictional appointment storefront or `/shop/maison-sable` for the fictional boutique. `/book/atelier-atlas` retains the V1 direct booking flow. `/signup` exercises email-first setup; `/inbox` is the local simulated email inbox. Demo accounts: `atlas@example.invalid`, `rivage@example.invalid`, `boutique@example.invalid`, and `staff@example.invalid`. Use `/login`, request a link, open the demo inbox and confirm it. Staff cannot change owner-only settings or financial records.

Merchant navigation: `/setup` edits identity/offers/styles/palettes/publication/pause/images; `/dashboard` opens the appropriate appointment or catalog view; `/retention` records the 0/1/2% merchant-funded terms and genuine Google review link; `/insights` shows measured events and declared sources; `/connections` shows delivery readiness and zero-send local fixture checks; `/account` exports, revokes previews or closes/anonymizes the business.

All phone numbers/customers in fixtures are fictional; never click the sample WhatsApp link to send a message. wa.me is a customer-initiated link, not reminder automation. No message, subscription charge, provisioning or external deployment is part of the demonstration.

## Under-90-second demonstration script

1. Appointment example: open Atelier Atlas, choose a service/slot and submit a synthetic booking. Keep the private management link; view the same appointment in the merchant agenda and cancel/reschedule if desired.
2. Boutique example: open Maison Sable, submit a product inquiry and view it in the boutique merchant view. Mark contact/remise only when appropriate. A demand is not a paid order; there is no inventory or shipping promise.
3. Show `/setup`, the published bio link/QR, pause/unpublish and an authorized 24-hour preview. Show `/connections` as disconnected/testing, then `/insights` with synthetic labels and null independent payment/acquisition evidence.

This script is designed for a short presentation; actual human completion under 90 seconds has NOT been measured. Automated mobile browser tests are 360px, not physical-phone usability trials.

## Reproduce local gates

Run sequentially: `npm run check`, `npm run test:e2e`, `npm run demo:scenario`, `npm run test:recovery`, `npm run demo:v2`, `npm run test:performance`, `npm run discovery:dry-run`, `npm audit --audit-level=moderate`, `npm run test:handoff`, `npm run test:safety`. Evidence files in ignored `artifacts/` include onboarding, recovery, performance, discovery and mobile screenshots. GitHub CI runs these local/mock gates and uploads them. It contains no deployment step.

## Data model and operations

Apply all migrations 0001–0012 in order to an owner-approved environment after backup. V1 tenants retain published appointments. Self-serve tenants begin draft with reminders/marketing/loyalty disabled. Verified-email provisioning and publication use transactions and unique guards; first offers and schedules are one idempotent transaction. Business-mode changes are refused after booking/inquiry activity. Public reads contain business information only; merchant IDs derive from verified sessions and CSRF-protected writes.

Catalog item photos use tenant-composite associations to owned assets. Signed five-minute uploads accept PNG/JPEG/WebP only, 256 KiB each, canvas dimensions at most 4096, ten images/2.5 MiB per tenant. Rights acknowledgment, MIME/signature/dimension/digest/size/tenant checks and D1 quota guards apply. SVG/HTML is rejected. Production requires an owner-provisioned optional `MEDIA` R2 binding; absent storage fails closed. The code uses original abstract initials when no photos exist. D1 and R2 cannot share one atomic transaction: digest keys make retries safe; an interrupted object write can leave an unreferenced object, which must be included in storage monitoring/lifecycle policy. Do not enable public bucket listing.

Catalog fulfills/payments/refunds use separate guarded append-only receipt tables and the common loyalty ledger. Catalog ledger rows have no V1 booking payment foreign key; `commerce-earn/redeem/reversal/restore` event keys trace their receipt. Gross declarations and refunds remain separate; processor verification and acquired-customer attribution remain null. FIFO redemption requires in-person verification; negative accounting balances block redemption. V1 appointment retention remains consent-aware and outbox-driven. Catalog review prompts are copyable neutral text for eligible first completed visits; catalog automatic marketing is intentionally not shipped.

Customer exports include catalog inquiries/receipts/refunds. Erasure clears inquiry notes/variants, suppresses marketing and retains anonymized financial history. Account deletion immediately deactivates the tenant, sessions, public site, previews and credentials; a durable deletion job processes at most 100 customers per pass and resumes via the scheduler. If object storage is temporarily unavailable, deletion remains pending. Do not put personal details in accounting receipt references or refund reasons. Agree legally required financial/audit retention before live use.

Recovery rehearses closed-runtime copies to a fresh directory and checks 29 D1 tables, appointment/catalog accounting, foreign keys and exact owned-image bytes. This is local synthetic recovery, not production Time Travel or a production RPO/RTO. Back up production D1 and object storage independently and rehearse their joint recovery under owner control.

## Owner action checklist — required before live pilot

- [ ] Review the PR and require green final-head CI; no automatic merge/deployment is configured by this work.
- [ ] Recruit five independent first-time merchants, time setup through first publish, record every assistance step and median time; target <=10 minutes. Validate the short demo on physical phones, French usability and keyboard/screen-reader flows.
- [ ] Approve privacy/CNDP, merchant ownership/provenance, customer consent, public contacts/policies, loyalty expiry/caps, review URL and financial retention with responsible advisers.
- [ ] Explicitly approve infrastructure/costs, choose isolated real D1/object storage, configure runtime secrets and actual HTTPS base URL, apply migrations/backups and a durable scheduler/alerts. Do not seed fictional merchants into production.
- [ ] Configure/verify the global Resend sender and signing secret for login/signup. Enable `SIGNUP_ENABLED=true` only after review of sender, abuse limits, monitoring and cost controls. Production fixture inbox/check endpoints are denied.
- [ ] Optionally onboard official WhatsApp accounts/numbers/templates and merchant-billed costs, verify current Meta permissions/coexistence and observe signed delivered receipts after connection. Publishing with wa.me alone requires none of these.
- [ ] Keep Instagram/OpenReply deferred unless separately approved and supported by merchant evidence. See [connector decision](V2_CONNECTORS_ADR.md); scope/app review/pricing remain unverified.
- [ ] Select subscription terms/prices/provider before any collection. `plan_definitions`/`plan_quotas` support owner-controlled configuration; collection is constrained disabled. There is no performance commission or checkout.
- [ ] Owner alone chooses and performs any external deployment, smoke test and rollback. Agent must never invoke Vercel or configure its deployment/build automation. This handoff contains no Vercel command or deployment workflow.

Arabic translation/RTL QA, independent penetration testing, production soak tests and live provider/recovery evidence remain unverified. Discovery is an isolated offline operations tool, not a scheduled scraper/outreach system; see [discovery runbook](V2_DISCOVERY_RUNBOOK.md).
