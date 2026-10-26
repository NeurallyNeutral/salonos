# 00 — Task definition, authority, limits

## Deliver exactly these things
1. **REAL PRODUCT:** Appointment and catalog storefronts connected to existing public Worker endpoints, with real customer booking/inquiry. A real merchant can register through one-use **real** email in production, configure/publish a shop, and operate bookings/inquiries in persistent D1. Local testing uses the existing localhost-only fake inbox, visibly stamped TEST MODE.
2. **GUIDED SANDBOX:** Fictional, interactive, beautiful product-like screens. Opening step chooses **Salon & rendez-vous** or **Boutique & produits**. Then user can toggle **Vue client** and **Vue commerce** in the SAME fictional business. Merchant onboarding includes a dedicated **E-mail** tab with a fictional verification message; mock email does not leave the browser. The sandbox never calls mutation endpoints for real users or D1.
3. **ONE visual design language:** specified exactly in `01_DESIGN_TOKENS.md` and `02_SCREEN_CONTRACTS.md`. The customer and merchant layouts are distinct variants of that language.
4. **PERSISTENT app functionality:** current server-side booking claims, inquiry idempotency, roles, secure auth, ledger/returns, privacy and provider state must not regress.

## Not requested — do not implement
AI agents, subscription billing, inventory/checkout, online payment, direct Instagram API, OpenReply integration, WhatsApp automation onboarding, shipping, growth dashboards, marketplace, calendar sync, new database vendors, price experiments, animation engines, vague artistic explorations, automated outreach, redesigned backend.

## Source inventory (this is real code, not mock)
- `src/index.ts`: Worker HTTP composition/routes, bundled frontend assets.
- `src/auth.ts`, `src/onboarding.ts`: session/verified email/merchant provisioning.
- `src/bookings.ts`, `src/availability.ts`: appointments and slot claiming.
- `src/storefront.ts`, `src/commerce.ts`: catalog/inquiries/payment entries.
- `src/media.ts`: signed merchant-owned image upload.
- `src/retention.ts`, `src/loyalty.ts`: loyalty business rules.
- `src/delivery.ts`, `src/providers.ts`, `src/connectors.ts`: notification/provider readiness.
- `web/app.txt`: app loader, existing booking/admin; `web/launch.txt`: existing onboarding/catalog UI.
- `web/index.html`, `web/app.css`: base shell and styling.
- `web/demo.*`: V3's inadequate standalone text-slide implementation; replace.
- `scripts/build.mjs`: bundles Worker and independent guided static build.
- `migrations/0001..0012`, `tests/`, `fixtures/`: protected working contracts.

## Evidence we trust
Previous bounded Worker tests passed 37/37 and browser flows 15/15 at the baseline. These prove limited application behavior, **not** product/design acceptance. The owner explicitly rejected the current UI as confusing and aesthetically inadequate. The onboarding hides legacy monolithic forms; the demo shows text slides, not workflow. Do not preserve that appearance.

## Single implementation authority
`AGENTS.md` -> `00_START_HERE` -> `01_DESIGN_TOKENS` -> `02_SCREEN_CONTRACTS` -> `03_STATE_AND_COPY` -> `04_API_AND_SECURITY_MAP` -> `05_FILE_PLAN` -> `06_DELIVERY_AND_TESTS`. This hierarchy replaces ALL prior product/agent prompts. Do not ask the owner to choose colors, fonts, navigation, layouts or copy; they are set in these files.

## Hard distinction: actual vs simulated
Real signup: email goes to actual mailbox through configured provider, link consumed server-side; development may use protected localhost fixture. Demo signup: fictional tab animation, no requests and no verified account. Real booking/inquiry writes to D1; demo booking/inquiry only updates ephemeral sandbox state. Neither mode may falsely claim a payment or message was actually sent.

## No browser access for GLM
GLM writes code and runs local non-browser checks only. It must NOT invent visual QA results. Owner/other reviewer can inspect rendered UI later. Build human-inspectable deterministic routes and screenshot instructions.
