# 05 — Ordered code implementation plan and exact ownership

**No design phase for GLM.** Implement the numbered specifications in this order. One milestone = focused files, tests, factual log. Never claim finished based only on tests.

## Milestone 0: baseline and cleanup sanity
- Work only in provided source tree, no git remote, no browser or web calls.
- Read AGENTS, specs 00..06. `npm run check`, `npm run test:handoff` if dependencies are installed. Record actual baseline in `spec/IMPLEMENTATION_LOG.md`.
- Do not change `src/` or migrations. Defer only owner-controlled live credentials.
- Ensure old `/demo/merchant` and `/demo/customer` can still be served until compatibility bridges built.

## Milestone 1: design primitives & tokens
Edit `web/app.css`, `web/demo.css`, `web/index.html`, `web/demo.html`; add `web/ui-tokens.css` if build can serve it same-origin. Pin local Instrument Serif / Manrope (only after owner-approved dependency acquisition). Implement buttons, inputs, field errors, cards, modal, merchant shell, customer shell, demo header/footer. Exactly match spec/01; replace legacy colors, card rotations and random scribbles.
Technical rule: same-origin asset routes required in `src/index.ts`, static build via `scripts/build.mjs`. No runtime CDN. Test `npm run build` and `npm run lint`. CSS target widths 360/390/768/1440.

## Milestone 2: guided sandbox (highest acceptance value; code, not prose slides)
Replace `web/demo.txt`, `web/demo.html`, `web/demo.css` and static generator in `scripts/build.mjs`.
Implement `/demo` with 2 vertical cards; customer/merchant perspectives; dedicated simulated Email tab; status and transitions per spec 02+03. Fictitious event object feeds both views. Make real-looking interactive storefront tiles, date picker/slot selection, inquiry form, merchant Today/Inquiries, not descriptions.
Each sandbox step a UI screen with controls. Use local in-memory state and history navigation; ZERO mutation HTTP requests; no real address displayed as "delivered". Copy exact French strings. Provide old /demo/customer and /demo/merchant compatibility. Static build must include root index.html, both entry routes, legacy client.html & merchant.html bridges; no external backend dependency. Add deterministic pure state tests for switching mode, invalid email, Back, reset, event propagation. Run npm build/check.
**Do not make every scene the same decorative paper card.**

## Milestone 3: real customer surfaces
Edit `web/launch.txt`, `web/app.txt`, `web/app.css`, minimal `web/index.html` and optional presentation modules. Reuse existing public booking/inquiry API, do not reimplement transactions.
- `/shop/:slug` salon: merchant-first editorial hero; service click carries service ID & source; four booking steps.
- `/shop/:slug` boutique: illustration/photo product cards, focused adjacent detail/inquiry; truthfully no order/payments/stock lock.
- `/book/:slug`: four-step progress, conflict recovery, summary.
- `/manage` original private token semantics.
Ensure robust E.164 normalization in UI, data retention on invalid submit, selected service/item and source persistence. Run relevant Node tests and any available nonbrowser contract tests; owner checks rendering later.

## Milestone 4: real owner onboarding
Rewrite UI `signupPage()` and `setup()` so **one step has only one rendered form** (not old hidden mega-form).
1. Real signup input -> dedicated check-inbox status. No local `/inbox` link on signup screen; dev-only inbox from separate development tools page. Actual real email remains a provider job.
2. Real verified server session -> business mode choice -> identity -> one offer/hours -> preview -> publication -> landing Today/Inquiries.
3. Preserve draft from server; hidden optional branding/loyalty/integrations until after publish; no fake initial publication.
4. Share/QR only after server result; no unsigned fake links.
5. Errors near fields, no button deadlocks.
No weakened `SIGNUP_ENABLED`, Origin, CSRF or mock inbox restrictions.
Run Node onboarding and any available nonbrowser unit tests; verify API shape to code.

## Milestone 5: real merchant operations IA
Edit dashboard rendering in `web/app.txt`, catalog rendering in `web/launch.txt`. Split UI surfaces for mode-specific `Aujourd’hui`, Agenda/Demandes, Clients, Prestations/Catalogue, Paiements & fidélité, Indicateurs, Réglages using route or explicit tab state. Use actual existing merchant endpoints, not a second fake dashboard. Proper desktop sidebar and mobile four-item bottom bar.
Keep under same domain, tenant-session-based. Preserve status mutation, catalog older inquiry search, ledger, role restrictions. No replacement of working `src/` with localStorage.

## Milestone 6: final build and deliver evidence
- Run `npm run check`, `npm run test:handoff`, `npm run test:safety`, `npm run test:recovery`, `npm run demo:scenario`, `npm run demo:v2`; `npm audit` only with owner-approved network/cache.
- Since GLM has **no browser**, do NOT report Playwright screenshots or aesthetic validation. Write owner screenshot checklist and start commands. If Playwright is available noninteractively, may run pre-existing tests without direct GUI/browser control as *code tests only*; owner will inspect UX separately.
- Ensure `git diff --check` if repository has local .git; owner may supply source ZIP without .git, so don't require Git to run tests that don't need it. `test:safety` currently references git files and may be BLOCKED without git metadata; record honestly.
- Present file-by-file changes, status matrix, test exit codes, exact blockers. Stop. No external deployment.

## Approved dependency rule
No new UI framework, backend, expensive animation package or icons dependency. Use CSS/SVG and existing application style. A one-time owner-approved font package install is allowed; use pinned `@fontsource/instrument-serif@5.3.0` and `@fontsource/manrope@5.3.0`. Add their assets via existing build pipeline, check licenses. All other packages require owner consent and technical justification. Do not leave unfinished package-lock changes.

## Do not touch without a proven regression
`migrations/`, `src/auth.ts`, `src/bookings.ts`, `src/commerce.ts`, `src/delivery.ts`, `src/loyalty.ts`, `src/privacy.ts`, `src/retention.ts`, `src/providers.ts`, `src/key-rotation.ts`. No schema changes just for UI.

## Priority on constrained budget
1 guided sandbox that genuinely demonstrates flows, 2 actual customer, 3 actual onboarding, 4 merchant IA, 5 optional motion finesse. Do not spread partial changes across all screens. Report completed milestone if stopping at budget limit.
