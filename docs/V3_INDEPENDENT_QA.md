# SalonOS V3 independent release QA

Review date: 26 October 2026. The first pass used PR head `d8f57035d1c30f3869f0dd09ecd2b11279bf4f0f` in a clean checkout. QA fixes are committed on the same branch; repeat the GitHub checks on the updated head before treating code gates as complete.

## Verdict

**NO-GO for private remote review or deployment.** Local primary merchant/customer journeys and both demos passed synthetic Chromium checks. The repository contains only an intentionally incomplete Cloudflare private-review template: its hostname and D1 values are placeholders, and Cloudflare Access is an owner-configured account policy, not a binding in this repository. No authenticated remote review endpoint exists to verify.

No backend/API booking, inquiry, payment/refund, or tenant-isolation defect reproduced in this review. One mobile navigation clipping defect was reproduced and fixed. No real email, WhatsApp, payment processor, or charge was invoked. This verdict does not mark simulated integrations as live.

## Independent evidence

- Exact remote PR head checked out in a separate clean Git worktree; it initially matched the local implementation tree apart from the owner’s README update.
- `npm ci`: pass, 0 audit advisories.
- `npm run check`: pass, lint/typecheck/build and 37/37 Node tests.
- `npm run test:e2e`: pass, 15/15 Chromium tests after the final QA changes. Coverage includes both onboarding modes, invalid slug retention, publication, customer booking and inquiry, cross-browser merchant handling, same-day manual appointment, refunds, search, and both demos.
- Browser sizes: 360px, 390px, and 1440px. Screenshots were inspected at phone and desktop sizes. App flows use the Worker/D1 Miniflare fixture; the independently served demo build works without a Worker or D1.
- `npm run test:recovery`: pass, exact synthetic 29-table snapshot/restore and owned image verification.
- `npm run demo:scenario`, `npm run demo:v2`, `npm run test:handoff`, `npm run test:safety`, `npm run discovery:dry-run`, `npm run test:performance`, and `npm audit --audit-level=moderate`: pass. No real external sends were made.
- A plain `npx wrangler deploy --dry-run` with no config now exits with an error before deployment; local D1 migration application via `npm run db:local` succeeds with the explicit local config.

## Findings fixed on the V3 branch

1. The prior manual-booking E2E could fall forward to tomorrow after hours, so it did not prove a same-day booking. It now extends only the synthetic tenant’s current-day hours through the actual UI, verifies all offered slots are in the future, creates an appointment, and checks the persisted start equals a slot returned for tenant-local today.
2. The default `wrangler.toml` could publish local D1/localhost/development values if someone ran Wrangler deploy without reading the owner guide. It is now `wrangler.local.toml`; `db:local` explicitly selects it, and a test guards against restoring an implicit deployment config.
3. Merchant and catalog navigation clipped labels within mobile horizontal scrollers. Both navigation groups now wrap; browser checks assert their full control rows fit at 360px/390px.
4. Demo coverage did not exercise reload. Both demo tests now complete, reload to the first scene, revisit their final scene, and test restart; demo requests are checked for no non-GET API writes.

## Owner blockers

- Create an isolated review D1 and HTTPS hostname, fill a local copy of `wrangler.private-review.example.toml`, and configure Cloudflare Access to deny all unauthenticated traffic before routing the Worker. Verify Access denial and allow-list behavior before sharing the URL.
- Supply the secret and any approved real mailbox/provider configuration only in the owner’s Cloudflare environment. Keep signup and external messaging disabled until separately approved. The remote configuration and providers remain unverified.
- The intermittent fixture 500 from the supplied independent audit was not reproduced; its cause remains unknown.
