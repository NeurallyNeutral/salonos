# V2 engineering progress

Updated 2026-10-15. V2_CODE_COMPLETE: NO. LIVE_PROVIDER_VERIFIED: NO. PILOT_READY: NO.

## Baseline and delta checklist

The approved remote kickoff is `4c87b2a613fc169866b090833d30beb0b7860771`. Its application tree matches the existing V1 implementation; four V2 documents are new. Work is isolated in a V2 worktree, preserving the original checkout's uncommitted browser test. Native Git auth is unavailable; publication uses the authorized GitHub connector with expected-head leases and tree equality. Repository remains private. No external deployment, provider sends, outreach or billing is authorized.

- V2-A: Read all four V2 documents, V1 mission/acceptance/architecture/loyalty/status/release gates; inspect application, migrations, tests. Baseline clean install/check/mobile/recovery gates in progress.
- V2-B: Add tenant modes/templates/feature flags and catalog items/inquiries with composite tenant constraints, idempotent submission, merchant fulfillment and API/mobile tests. Preserve V1 atomic bookings and payment ledger.
- V2-C: Email-verification-first signup, atomic provisional provisioning, resumable draft, validated slug, palette/contact/content, explicit publication/pause/unpublish, first-publish timing, link/QR, safe owned assets. Reuse secure session/CSRF model. No account-existence leak or public bootstrap privileges.
- V2-D: Retain V1 completed-payment loyalty and neutral reviews; explicit terms/0/1/2% settings, source/funnel metrics, WhatsApp customer-initiated fallback and truthful automation readiness. Catalog payments must use guarded append-only accounting, never inquiry intent.
- V2-E: Connector readiness with truthful disconnected/testing states; narrow Instagram feasibility decision and fixture contract tests. OpenReply runtime deferred; official WhatsApp remains distinct.
- V2-F: Independent discovery import/scoring/deduplication/suppression dry run with synthetic candidates; no scraper, sends or merchant activation.
- V2-G: Separate synthetic demo database, appointments/retail examples and corresponding dashboards, safe previews, mobile/accessibility/security/performance/recovery gates and complete owner handoff.

## Decisions and release dependencies

Use additive D1 migrations and the existing Worker/Hono/static UI. Existing V1 merchants retain published appointments behavior. New self-serve tenants start unpublished, reminders/marketing/loyalty off and optional provider connections absent. All merchant writes derive tenant from verified sessions. Draft preview is owner-authenticated; share previews require explicit authorization and contain public business content only.

Five independent human first-time setup trials and real phone usability cannot be substituted by automation. Record local automated setup timings separately. Live email verification requires an approved sender; fixture inbox is local-only. Signed object uploads require owner-provisioned storage; do not enable arbitrary external images or fake successful uploads. Live providers, legal/CNDP and owner deployment remain external gates.

## Test evidence

Pending baseline commands: `npm ci`, `npm run check`, `npm run test:e2e`, `npm run test:recovery`. Exact results will be recorded after completion; V1 historical green status is not V2 evidence.

Baseline V2-A evidence: npm ci PASS (52 packages, audit 0 vulnerabilities); npm run check PASS (lint/typecheck/build, 26/26 Node scenarios, 0 failed/skipped, 51.57 s); npm run test:e2e PASS (5/5 mobile Chromium scenarios, 14.9 s); npm run test:recovery PASS (2 bookings, 8 claims, ten-table equality and 120-centime balance; backup 24 ms, restore/verify 955 ms). No live provider evidence. Full V1 suite preserved.

V2-B implemented: additive migration 0008; mode/template/palette validation; atomic catalog inquiries with composite FKs and rollback; tenant-only catalog and fulfillment; source events; mobile storefront and retail merchant view; fictional retail fixtures. Typecheck PASS, npm run check PASS 27/27 (47.84 s), mobile E2E PASS 6/6 (14.2 s). Concurrent same-key inquiries produced one creation, one persisted lead/event, no financial credit. Cross-tenant and unpublished/mode/paused checks pass. V1 booking contention remains green.

V2-C implemented: verified email creates an atomic provisional owner/tenant/session; durable verification delivery adapter (local inbox or disabled/Resend, acceptance only), race/expiry/replay/rate gates; production signup defaults disabled. Resumable D1-backed setup, atomic idempotent first offer/schedule, reserved slug/collision/markup controls, three styles/palettes, publication prerequisites, first-publish event, pause/unpublish, bio link and generated QR. Signed tenant-bound owned-image uploads use optional R2 (local mock binding), deny SVG/mismatched content; absent live storage is BLOCKED. Authorized 24-hour immutable prospect previews contain only public content and disable transactions/contact. npm run check PASS 30/30 (53.92 s), mobile/accessibility E2E PASS 8/8 (17.8 s), typecheck/format/diff PASS. Human five-user timing gate remains untested; automated flows are not human evidence.

V2-D implemented: fulfilled catalog receipts/refunds use append-only tables and the shared V1 loyalty ledger, integer earn/FIFO redemption/proportional reversal, actual-payment confirmation and in-person redemption authority. New merchants must acknowledge merchant-funded terms; 0/1/2% settings and neutral first-completed-visit prompts contain no satisfaction/reward gate. Catalog prompts are copyable only, never silently sent. Tenant funnel/source/setup/support/usage metrics label synthetic data and unavailable attribution/processor verification. Plans/quotas are configurable in D1 with all collection disabled. Full check PASS 31/31 (61.97 s); mobile E2E PASS 8/8 (21.5 s); dedicated race/refund/redemption/immutability/isolation test PASS.

V2-E implemented: readiness state machine, local-only zero-send fixture checks, tenant revocation, encrypted-token wipe, and real delivered-receipt requirement after connection updates. Instagram stays explicitly deferred; no OpenReply code/runtime imported. Primary sources and unresolved permissions/pricing/coexistence captured in V2_CONNECTORS_ADR. Initial fixture INSERTs required explicit column lists after the additive timestamp (assertions unchanged); one concurrently run diagnostic encountered a local workerd connection error, corrected by normal serial suite execution. Focused existing operations/providers plus connector checks PASS 7/7. Combined V2 E/F full check PASS 33/33 (60.97 s), mobile E2E 8/8 (22.3 s).

V2-F implemented: independent offline SQLite lead pipeline; authorized JSON import, complete-batch validation/transaction, canonical URL deduplication, persistent opt-out suppression, evidence-based scoring with rationale, human-review status and template suggestion. Followers/first-seen never imply founding/sales. Dry run PASS: 12 synthetic candidates, 10 unsuppressed shortlisted, 0 network requests/sends/merchant activations. Discovery-specific test PASS plus combined 33/33 suite. No scheduler or outreach service configured. See V2_DISCOVERY_RUNBOOK.
