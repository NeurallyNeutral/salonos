# V3 UX release progress

Updated 26 October 2026. `LOCAL_CODE_COMPLETE: YES` for the bounded V3 slice below. `CODE_COMPLETE: NO` until final-head GitHub CI passes. `LIVE_PROVIDER_VERIFIED: NO`. `PILOT_READY: NO`. No external deployment, sends, billing or production data.

## Preflight

- GitHub connector verified `NeurallyNeutral/salonos`; `codex/v2-launch-kit` remote head is `660605c5bf8574b928b1c22bd786216e9aab5b89`. Remote `codex/v3-ux-release` was created from that exact head. GitHub reports the repository as **public**; the owner explicitly authorized a public V3 push in this task. Visibility and permissions were not changed. Direct Git HTTPS fetch from this host failed, so local development uses the clean V2 implementation worktree at `f831655a0167788ed272d949fe8eaba3e809e387`; its implementation matches the remote V2 tree except for the owner's later README update. The original `codex/pilot-implementation` checkout has an unrelated uncommitted E2E edit and was left untouched.
- Read `AGENTS.md`, V2 handoff/progress, issue #3 and the attached independent UX audit. The audit is evidence and recommendations, not instructions overriding the owner request.
- First `npm run check` failed because the new worktree had no dependencies (`ERR_MODULE_NOT_FOUND: prettier`). `npm ci --prefer-offline` completed; npm reported 3 advisories (2 moderate, 1 high). Baseline `npm run check` then passed syntax, typecheck, build and 36/36 Node scenarios.

## Work queue

1. Repair form validation, local walk-in date, errors and regressions.
2. Separate operational catalog jobs and improve customer item context.
3. Apply coherent responsive design and two guided synthetic demos.
4. Run complete local/browser gates, capture screenshots and prepare owner-operated release instructions.

No live email, WhatsApp or payment verification is inferred from local fixtures.

## Implemented V3 slice

- Customer storefront: merchant-first chrome; selected service is carried into booking; valid source tags are preserved without inventing Instagram attribution. Product inquiry stays immediately after the chosen item with variant, indicative price, stock/payment limits and a reversible close action.
- Merchant: today-first appointment panel, calendar and message-problem links; compact operational navigation with secondary areas behind a disclosure. Catalog work separates inquiries, item editing and payment/loyalty, retaining 100-row pagination and adding tenant-scoped search by customer name, phone, item name or inquiry ID.
- Onboarding: a dedicated real-account check-inbox scene, then identity, first offer, preview, publication and optional branding/preview steps. Real verification still requires a consumed one-use link. Demos have independent simulated email scenes and never invoke real APIs.
- Forms: corrected native slug pattern for Chromium's Unicode `v` parsing; browser and server errors appear at fields and clear on edit; manual appointment defaults to tenant-local today, while public booking still starts tomorrow. Added specific server error copy for common slug, consent, image, and publication failures.
- Presentation: a shared responsive token scale; standalone guided demo build at `dist/guided-demo` and matching Worker routes. CSS motion respects reduced-motion settings.
- Private-review template is deliberately undeployable until the owner supplies an HTTPS hostname and isolated D1 ID. The filled config is ignored by Git. The mock inbox remains localhost-only.

## Verification so far

- Baseline after install: `npm run check` PASS, 36/36 Node scenarios. The first pre-install attempt failed only because dependencies were absent.
- V3 check after initial changes: `npm run check` PASS, 36/36. `npm run test:e2e` PASS, 14/14 at 360px; real customer and merchant screenshots also captured at 390px and desktop. A later focused 10/10 browser rerun passed after moving the daily panel above secondary navigation.
- Targeted onboarding browser rerun: 3/4 passed; one test clicked Reload before the save navigation completed (`net::ERR_ABORTED`). Added an explicit URL wait; subsequent full 14/14 browser run passed. No product 500 was reproduced.
- `npm run test:recovery` PASS, 29-table snapshot equality, two bookings, eight slot claims, catalog/appointment accounting and exact image bytes. `npm run demo:v2` PASS, five automated synthetic merchants with persistence; no human study. `npm run test:performance` PASS: 20 local requests, p95 178 ms, UI gzip 27,360 bytes (local synthetic only). `npm run test:handoff` and `npm run test:safety` PASS.
- `npm audit --audit-level=moderate` initially FAILED with 2 moderate and 1 high advisory in the Miniflare/Wrangler `undici` dependency. Updated the override to `^7.30.1`, regenerated the lockfile and reran `npm ci`/audit: 0 vulnerabilities. Full post-update tests are in progress.
- A later full browser run passed 13/14: the old manual-booking test selected the 31st slot, which is not guaranteed once its default changed from tomorrow to today. It still verified the tenant-local default. The test now selects an available same-day slot, falling forward only if no same-day slot remains; the booking assertion is preserved. Subsequent targeted and full reruns passed.
- Final local head: `npm run check` PASS (lint, typecheck, build, 36/36 Node tests); `npm run test:e2e` PASS (15/15 Chromium journeys including real storefront/merchant, both guided demos and standalone static serving); focused merchant UI search/verification/publication rerun PASS (4/4). `npm audit --audit-level=moderate` PASS (0 vulnerabilities); `git diff --check` PASS. Local recovery, V2 demo, performance, synthetic scenario, discovery dry run, handoff and source-safety gates all PASS. Browser screenshots in ignored `artifacts/v3/` were visually inspected at 390px and 1440px; loading-state captures were corrected and recaptured.

## Remaining limits

- The attached audit's intermittent fixture 500 did not reproduce in scripted journeys or the 20-request local performance run; root cause remains unknown. Do not claim it is fixed.
- Search is server-side and tenant-scoped but still scans within D1 `LIKE`; large production volumes need measured index/latency review. Catalog customer history remains represented through inquiries and account export, without a dedicated customer-history page.
- Remote Cloudflare Access, actual test mail, real provider delivery, R2, legal/privacy review, independent human usability and owner deployments are external gates. `PILOT_READY: NO`.

## Interaction principles used

The change from aggregate-first to today-first navigation applies [NN/g's visibility of system status and recognition over recall](https://www.nngroup.com/articles/ten-usability-heuristics/): an operator sees appointments and message problems before looking through reports. The close action on an inquiry and the setup step links apply its user-control principle. The field-level validation, retained values and one-screen inquiry context follow [Baymard's form-structure and label guidance](https://baymard.com/blog/form-design). These are design rationales, not measured SalonOS conversion improvements or human usability evidence.

## Independent release QA

An independent QA pass used a clean checkout of the pushed PR head and a separate local Worker/D1 test runtime. It found and fixed three release-evidence/usability issues: the manual-booking browser test could silently select tomorrow after closing time, the default Wrangler configuration could select local development settings during an unqualified deploy, and mobile merchant/catalog navigation clipped labels. Demo browser tests now also exercise reload and restart. Details and exact evidence are in [V3_INDEPENDENT_QA.md](V3_INDEPENDENT_QA.md).

After these fixes, `npm run check` passed 37/37 Node tests, and `npm run test:e2e` passed 15/15 Chromium tests at 360px, 390px and 1440px, including actual storefront/merchant pages and both guided demos. Source safety, recovery, handoff, synthetic scenarios, performance, discovery dry-run and `npm audit` passed. Final-head GitHub CI must pass again after the QA update. Remote Cloudflare Access and private review remain unverified; overall private review/deployment decision is **NO-GO** until the owner configures and verifies the protected review environment.
