# 04 — Existing server/API map: reuse, do not reinvent

This inventory is grounded in the source (V3 tested baseline). UI implementer MUST read the current endpoint function to confirm payload and statuses before modifying a caller. Server-side handler remains authority. No new public "merchant" APIs without owner review.

## Route prefixes from src/index.ts
`/auth` -> src/auth.ts; `/signup-api` -> src/onboarding.ts; `/merchant` -> src/auth.ts and imported merchant handlers; `/public` -> src/bookings.ts; `/storefront` -> src/storefront.ts; `/manage-api` -> src/bookings.ts; `/preview-api` -> src/onboarding.ts; `/media` -> src/media.ts.

## Real authentication and onboarding
| Method+path | Existing purpose | UI calls/notes |
| --- | --- | --- |
| POST /signup-api/request | start email challenge | JSON `{email}`; rate limited, generic response; production gated SIGNUP_ENABLED |
| POST /signup-api/consume | consume one-time verification | JSON `{token}`; REAL SESSION cookie, no mock bypass |
| POST /auth/request | send login magic link to registered merchant | JSON `{email}`; never enumerate accounts |
| POST /auth/consume | consume login token | JSON `{token}` |
| GET /merchant/session | merchant identity and CSRF value | never forge; included cookie |
| GET /merchant/launch | tenant draft and catalog metadata | load after session |
| PUT /merchant/launch | save identity/mode/branding settings | require revision concurrency; inspect exact `src/onboarding.ts` schema |
| POST /merchant/launch/offer | create first service OR catalog item | idempotency key, price in centimes, for salon duration+start/end minutes |
| POST /merchant/launch/publish | explicit owner/policy confirmation; publish only when complete | `Idempotency-Key`, `confirm_ownership:true,confirm_policies:true` |
| POST /merchant/launch/unpublish | remove public shop | authenticated owner |
| POST /merchant/launch/pause | pause booking/inquiries | `{paused:boolean}` |
| POST /merchant/launch/previews | authorized prospect preview | owner control |
| GET /merchant/launch/qr.svg | actual storefront QR | requires merchant session |
| GET /merchant/config | timezone, schedule, services, settings | full source contract in `src/config.ts` |

Important: some first-offer operation seeds every day with hours; UI must **show/correct actual hours** via `PUT /merchant/hours` (source `src/config.ts`) and must not promise selected weekdays without applying them. Existing business mode cannot be casually changed after activity. No fake "public link" before publish succeeds.

## Real customer appointment
| Method+path | Purpose |
| --- | --- |
| GET /public/:slug | public salon/services configuration |
| GET /public/:slug/availability | eligible real slots |
| POST /public/:slug/bookings | create booking with atomic occupancy claims |
| GET /manage-api/:id | token-guarded private booking detail |
| POST /manage-api/:id/{kind} | booking cancellation or rescheduling with token constraints |
| GET /merchant/availability | merchant eligible availability |
| POST /merchant/bookings | manual booking, today-first default |
| GET /merchant/bookings | tenant agenda |

KEEP: original `web/app.txt` booking request construction and server data shape; lift it into new 4-step UI without inventing fields. Absolute timestamps stored in UTC, display using tenant-local date/time. Retain booking conflict and idempotency guards.

## Real boutique
| Method+path | Purpose |
| --- | --- |
| GET /storefront/:slug | business info, catalog data, WhatsApp link |
| POST /storefront/:slug/inquiries | inquiry only, not order; name/phone/quantity/etc; idempotent |
| GET /merchant/catalog | merchant items |
| POST /merchant/catalog | create item |
| PATCH /merchant/catalog/:id | update item |
| PUT /merchant/catalog/:id/image | attach owned photo |
| GET /merchant/inquiries?offset=0&q=... | 100-row tenant-scoped page, search name/phone/item/id |
| PATCH /merchant/inquiries/:id | new/contacted/fulfilled/cancelled states |
| GET /merchant/inquiries/:id/payments | merchant-recorded payment history |
| POST /merchant/inquiries/:id/payments | explicit merchant-confirmed amount received; requires fulfilled |
| POST /merchant/commerce-payments/:id/refunds | ledger adjustment |

Do NOT re-label `inquiry` as `order`; no checkout/stock guarantee, no delivery integration. Search `LIKE` may not scale unbounded; no claims about massive catalog performance.

## Merchant details
- `PATCH /merchant/settings`, service/resources/hours/closures endpoints from `src/config.ts`.
- `POST /merchant/retention-settings` and `GET /merchant/launch-metrics` from `src/launch-metrics.ts`.
- `GET /merchant/customers/:id/export` and privacy erasure from `src/operations.ts`.
- `/merchant/assets/ticket` / `/merchant/assets/upload` from `src/media.ts`. Owner rights acknowledgment, PNG/JPEG/WebP, 256 KiB, signed 5-min ticket and quota checks remain intact. Missing R2 disables upload visibly.
- `GET /merchant/plan-usage` not payment collection. No subscription provider live.

## Browser security invariants
- Existing Worker checks Origin and JSON Content-Type on non-GET routes.
- Merchant session uses HttpOnly, Secure, SameSite=Strict cookie. CSRF header from `GET /merchant/session`; do not store token in public/static demo.
- All merchant mutations derive tenant from server session; never accept UI-provided tenant ID.
- Public customer management tokens are private, not included in demo snapshots, URL logs, analytics or clipboard without request.
- No live provider verification or real payment confirmation proven by local fixture.
- `/dev/inbox`, `/dev/process`, `/dev/messages` remain localhost-only via `local(c)`; **do not soften or expose remotely**.
- Worker CSP `style-src 'self'; script-src 'self'`: fonts, CSS, JS must be served same-origin; any new static assets require explicit safe Hono routes and build inclusion.

## JSON shape discipline
1. Read actual handler for required fields and validation.
2. Reuse existing app `api()` JSON/CSRF/error helpers, or extract without regression.
3. Generate idempotency only where server demands, stable across retry.
4. No client-only business state backing actual bookings/loyalty.
5. Confirm request/response in Node/Worker/D1 test, then bind UI.

## Owner-side release
No implicit deploy config: `wrangler.toml` was deliberately removed after QA. `wrangler.local.toml` is LOCAL ONLY. `wrangler.private-review.example.toml` contains intentionally unresolved values, requires owner-supplied isolated D1/Access/secret and can never be deployed as-is. GLM must not populate secret values or deploy.
