# SalonOS — Full Product Demo

This pack is a complete **product-surface demo** plus a tiny zero-dependency local API server.

## Fastest test drive

Open `index.html` directly in a browser. It runs as a self-contained interactive simulation and persists demo changes in `localStorage`.

## Full-stack local mode

Requires Node 20+.

```bash
node server.mjs
```

Then open:

```text
http://localhost:8787
```

The demo API exposes:

- `GET /api/health`
- `GET /api/state`
- `POST /api/reset`
- `GET /api/baddie-spot/services`
- `GET /api/baddie-spot/availability?date=YYYY-MM-DD`
- `POST /api/baddie-spot/book`
- `POST /api/bookings/:id/status`
- `POST /api/cron/run`

The UI is intentionally richer than this tiny local API; the UI simulates the entire product stack so every role can be test-driven without external accounts.

## Surfaces included

1. Customer booking funnel
2. Customer self-reschedule / cancellation
3. Merchant dashboard
4. Merchant calendar and appointment outcomes
5. Lightweight client CRM + CSV export
6. Services, weekly hours and blackouts
7. Confirmation / reminder / review automations
8. Analytics and attribution-safe case-study metrics
9. Merchant settings + booking pause
10. Merchant onboarding wizard
11. WhatsApp / email delivery simulator
12. SalonOS platform admin across tenants
13. Billing / MRR view
14. Observability + failure injection
15. Architecture and event stream
16. Case-study output

## What is simulated vs production

This demo proves the product workflow and operating model. It is **not production infrastructure**. The production build still needs:

- Cloudflare Worker/Hono API wired to D1
- transactional resource collision protection
- completed magic-link merchant authentication
- encrypted Meta credentials
- Meta embedded onboarding and verified webhooks
- approved WhatsApp utility templates
- retry + idempotency semantics for outbound messaging
- real billing/dunning
- backups, retention, privacy/export/deletion flows

The previous Cloudflare/Hono/D1 scaffold remains the production starting point.
