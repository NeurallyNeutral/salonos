# SalonOS

V2 Launch Kit adds verified self-service setup, reusable appointment/catalog storefronts, inquiries, merchant-funded retention, truthful metrics and optional connector readiness. Start with `npm ci` then `npm run demo`; open `http://localhost:8787/shop/atelier-atlas` or `http://localhost:8787/shop/maison-sable`. Create a fictional merchant at `/signup` and verify it in the local `/inbox`. No cloud accounts or Docker required.

See [V2 engineering evidence](docs/V2_PROGRESS.md), [local demo and owner handoff](docs/V2_HANDOFF.md), [optional messaging decision](docs/V2_CONNECTORS_ADR.md) and [separate discovery tool](docs/V2_DISCOVERY_RUNBOOK.md). Live providers, human usability and pilot readiness are not implied by code completion. Deployment is owner-operated only.


French appointment and retention application built with Workers, Hono, TypeScript and D1. The local application has real persistence, tenant isolation, atomic booking claims, merchant workflows, payment/loyalty ledgers and durable notifications. No cloud account, Docker or payment method is needed locally.

**Live deployment, real email/WhatsApp delivery and pilot approval remain blocked.** See [release status](docs/STATUS.md) for separate CODE_COMPLETE, LIVE_PROVIDER_VERIFIED and PILOT_READY gates. Fixtures verify adapter behavior, not real delivery. Payments are merchant-reported, never independently processor-verified revenue.

## Launch locally — Windows PowerShell

Install Node.js 24 LTS (npm included) and Git. From the existing checkout:

~~~powershell
Set-Location 'C:\Users\User Ob\Downloads\SalonOS_Codex_GitHub_Handoff'
node --version
npm ci
npm run demo
~~~

For a new checkout, authenticate to the private repository using your own Git credential manager, then run `git clone --branch codex/pilot-implementation https://github.com/NeurallyNeutral/salonos.git` and enter that directory before the npm commands. Never put a token in a clone URL or source file.

Open **http://localhost:8787**. Keep the terminal open; stop with Ctrl+C. The launcher builds, migrates and inserts synthetic fixtures once. Changes persist in `.wrangler/demo/d1`; the generated encryption key is `.wrangler/demo/app-secret`. Do not delete the key while retaining the database. The demo listens only on the local machine with clearly labeled mock providers. Use `localhost`, not the IP address, for the configured origin and secure development cookies.

| Screen | URL / account |
|---|---|
| Atlas booking | http://localhost:8787/book/atelier-atlas |
| Rivage booking | http://localhost:8787/book/studio-rivage |
| Merchant sign-in | http://localhost:8787/login |
| Atlas owner | `atlas@example.invalid` |
| Rivage owner | `rivage@example.invalid` |
| Atlas staff (restricted role) | `staff@example.invalid` |
| Mock inbox | http://localhost:8787/inbox |
| Liveness / readiness | http://localhost:8787/health / http://localhost:8787/ready |

Request a link, open the demo inbox, follow the latest link for that address, and confirm sign-in. Links expire after ten minutes and work once; more than three requests per address in ten minutes are rate limited. There are no default passwords. Never enter real customer data into this shared local fixture inbox.

## Complete walkthrough

1. Book tomorrow at Atlas using a synthetic name and `+212600000091`. Select email/WhatsApp consent explicitly. Keep the management link to reschedule or cancel.
2. Sign in as Atlas in another browser. Open **Agenda**, select tomorrow, and confirm the appointment. Reload or clear browser localStorage: D1 retains it. Add a manual appointment; occupied times are unavailable publicly.
3. In **Réglages**, choose 1% or 2% loyalty. For payments, use yesterday's seeded **Visite Démo atlas**: mark completed, open **Paiement & fidélité**, explicitly confirm an actual fictitious payment of 120 MAD, then record it. At 2%, the ledger earns 2.40 MAD; a 60 MAD partial refund reverses 1.20 MAD. Future visits cannot be marked completed early.
4. To demonstrate reviews, enable marketing/review prompts and enter `https://g.page/r/demo/review` **before** completing the seeded visit. This synthetic URL is not a real business review destination. The seeded visit has synthetic consent; real consent must never be assumed.
5. Open the mock inbox / merchant messages to process jobs. `provider_accepted` means accepted by the mock, not delivered. The local launcher does not run a background clock: inbox processing handles due jobs. The automated scenario makes reminder jobs due in isolated fixtures and injects an outage.
6. Sign in as Rivage in an independent/private browser: Atlas customers, appointments, payments and exports are unavailable.

Past fixture visits are inserted once. Re-running the launcher preserves their changed status. For a repeatable isolated demonstration without changing the persistent demo:

~~~powershell
npm run demo:scenario
~~~

This verifies two merchants, booking, transient message failure/recovery, both reminders, merchant-recorded payment, 2% grant, partial refund and neutral review. All providers are mocks.

## Run all checks

From the repository in a second PowerShell terminal:

~~~powershell
npm run check
npm run test:handoff
npm run test:safety
npm audit --audit-level=moderate
npx playwright install chromium
npm run test:e2e
npm run demo:scenario
npm run test:recovery
~~~

Check each exit code: PowerShell does not automatically stop a pasted sequence on native-command failure. `check` runs source syntax/formatting, TypeScript, bundle and all API/Worker/D1 tests. E2E starts an isolated server on port 8790 and tests Chromium at 360px, including axe accessibility checks. Generated screenshots/recovery results are in ignored `artifacts/`. CI also installs Chromium Linux dependencies. See [QA coverage](docs/QA_MATRIX.md) and [operations](docs/RUNBOOK.md).

## Implementation boundaries

- D1 is the source of truth. Unique five-minute resource claims and transactional batches prevent overlapping public/manual bookings and partial reschedules.
- Single-use email links create tenant-scoped HttpOnly sessions. Mutations require role authorization, origin and CSRF checks. Customer management tokens are strong, hashed and revocable.
- French mobile UI/API: services, resources, hours, closures, pause, day/week agenda, attendance, customer export/erasure, CSV, metrics and payment/loyalty/refund flows.
- Resend/Meta adapters: encrypted configuration, signed receipts, consent, persistent retries and explicit uncertain outcomes. Onboarding and real contract validation are external gates.
- Loyalty: immutable merchant-funded discount ledger, capped 1–2% grants, FIFO redemption, reversals and optional expiry. No wallet or cash custody. Subscription event/status infrastructure exists; commercial billing is disabled.
- French is delivered. A message dictionary and language/direction boundary begin localization; full Arabic copy and RTL browser validation remain future work.

`reference/` preserves historical unsafe/simulated material solely for provenance; it is never imported or served. No deploy script or automatic deployment is configured. All live infrastructure remains owner-controlled.
xxx
