# SalonOS — Codex Engineering Handoff

**Status: NOT PRODUCTION READY.** This is a complete engineering handoff and safe Worker bootstrap, not a finished app. The prior interactive demo is *simulated* and the prior API *unsafe*. Do not deploy the reference demos as customer software.

## Product
Multi-tenant booking + reminders + merchant operations + opt-in loyalty credit + neutral review requests for Moroccan appointment businesses. Product must minimize ongoing founder support and run economically on Cloudflare Workers/Hono/D1. Platform keeps control of business logic; providers are adapters.

## Source of truth
1. `AGENTS.md` — persistent Codex agent rules and execution loop.
2. `docs/CODEX_MISSION.md` — prioritized work and definition of done.
3. `docs/PRODUCT_SCOPE.md` — use cases, constraints and what is parked.
4. `docs/ACCEPTANCE_TESTS.md` — required demonstrable tests.
5. `docs/ARCHITECTURE.md` — infrastructure, concurrency, tenant isolation.
6. `docs/LOYALTY_AND_REVIEWS.md` — cashback credit and reviews guardrails.
7. `docs/EXTERNAL_DEPENDENCIES.md` — provider blockers and no-go gates.
8. `reference/worker_scaffold/` — prior Cloudflare scaffold, **insecure, reference only**.
9. `reference/interactive_demo/` — prior full-product demo, **simulated, reference only**.

## First commands
```sh
npm install
npm run typecheck
npm test
npm run dev
```
Open `http://localhost:8787/health` for the **bootstrap only**. An actual product must be implemented and tested by Codex; `/ready` intentionally returns HTTP 503.

The first `npm test` checks only that the handoff package is coherent. **It does not certify product behavior.** Codex must replace/add comprehensive Worker/D1 integration and UI E2E tests.

## Where to continue
Give Codex the folder and tell it to read `AGENTS.md` and complete `docs/CODEX_MISSION.md` autonomously. Copy the prepared instruction in `CODEX_START_PROMPT.txt`.

## Decisions NOT finalized
Do not hardcode a 990/1990 MAD subscription or performance commission. Price is commercial hypothesis. Loyalty points are merchant-funded, not SalonOS rewards. Client retention is not proven by appointments passing through the system. Read `docs/ASSUMPTIONS_AND_METRICS.md`.

## Delivery requirements
A completed local demo must run with fake WhatsApp/email/payment adapters, persistence, two+ tenants, security, fixtures and automated tests. Real Meta messaging, Cloudflare production setup, billing and legal approval require externally provisioned accounts; those are recorded explicitly as blockers, not faked.
