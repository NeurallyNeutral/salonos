# SalonOS status

Updated 2026-10-08. CODE_COMPLETE: YES. LIVE_PROVIDER_VERIFIED: NO. PILOT_READY: NO.

M0–M6 source is implemented and its local/CI code gates pass. M6 uncommitted work from the interrupted session was preserved and extended. PR #1 contains the final test evidence and remains available for review; no live deployment or provider onboarding was attempted. CODE_COMPLETE describes the implemented local and adapter scope, not live-provider or pilot approval.

## Current M6 scope and remaining gates

Local release evidence (Node 24.11.1, Windows, 2026-10-08): clean `npm ci` PASS; `npm run check` PASS (format/syntax, typecheck, bundle, 26 Node test scenarios: 26 passed, 0 failed, 0 skipped); `npm run test:e2e` PASS (5/5 Chromium mobile scenarios, including axe and keyboard checks, 34.7 seconds); `npm audit --audit-level=moderate` PASS (0 vulnerabilities); `npm run demo:scenario` PASS; `npm run test:recovery` PASS; `npm run test:handoff` PASS; `npm run test:safety` and staged diff check PASS. Recovery: 2 bookings, 8 claims, exact ten-table snapshot equality, foreign keys and payment/refund/120-centime balance; local backup 43 ms, restore/verification 2083 ms. These timings are not a production SLA. Screenshot review found no clipped controls at 360px.

GitHub implementation evidence: [SalonOS release gates run 37779647019](https://github.com/NeurallyNeutral/salonos/actions/runs/37779647019) completed successfully for M6 head `a91901fd73e80210720314a54cb09f6ed8a17c28`. Every required job step passed: clean install, audit, lint, typecheck, build, Node tests, handoff/source checks, Linux Chromium installation, E2E, demo, recovery and evidence upload. Remote tree `b7d385063c8188e5936611a6711ac63a1db4b3ca` exactly matches local M6 commit `251b7f4`. Subsequent documentation-only commits use the same required workflow; consult [PR #1](https://github.com/NeurallyNeutral/salonos/pull/1) for final-head checks.

Persistent local launch also passed: `npm run demo`, `/health` 200, `/ready` 200 and the public booking page 200. No external infrastructure was touched. The demo retains only synthetic fixtures and uses mock providers.

M6 adds privacy export/anonymization and race-safe retention, operational health, immutable subscription events with disabled/mock billing, restart/recovery fixtures, current/previous key rotation and full re-encryption, stable unsubscribe links, receipt-race protection, consent email snapshots, large exports/pagination, local provisioning, source checks, browser accessibility and a complete runbook.

Audit outcomes: forty public contenders and forty mixed manual/public contenders each produce exactly one booking and 39 conflicts. Concurrent cancel/reschedule preserves occupancy with one sensitive-token winner. Retention rechecks activity/current policy inside its transaction. Erasure cannot be undone by a prepared retention message or key rotation. Delivered receipts cannot be downgraded by later failed/uncertain send results. Display/conversion uses canonical Worker timezone data. Seeds do not resurrect deleted schedules after restart.

Live blockers: approved Cloudflare provisioning/deployment and live recovery; Resend sender/domain/credentials and signed delivery; Meta assets/current version/templates/credentials and signed delivery; live scheduler/alert destination; contracts/privacy/CNDP review and actual merchant review URL. Commercial subscription collection is disabled pending provider/terms selection. Full Arabic translation/RTL QA, production-scale soak testing and independent penetration testing are not delivered features. Native Git auth is unavailable here; authorized connector publication verifies content through identical Git tree hashes.

See [README](../README.md), [QA coverage](QA_MATRIX.md), [runbook](RUNBOOK.md), [provider contracts](PROVIDERS.md) and [release checklist](RELEASE_CHECKLIST.md) for commands and owner actions.

## Historical milestone record

Baseline audit: the only working application endpoints are /health and a deliberately failing /ready. No application migrations, authentication, real booking, delivery or product tests exist. The reference Worker has unauthenticated tenant reads and non-atomic booking. The reference demo uses memory and browser fixtures. Both remain quarantined, outside the application build.

GitHub: NeurallyNeutral/salonos is private and initially empty (verified using the GitHub connector). Initialized a project-local Git repository because the inherited parent repository contains unrelated projects. Native Git credentials cannot access this repository; use the authorized GitHub connector for source publication. Never change repository visibility or permissions. No deployments are authorized.

Queue: M0 foundation and migration; M1 authentication/configuration; M2 atomic booking; M3 durable messaging; M4 French merchant/customer UI; M5 payment ledger/loyalty/reviews; M6 adversarial QA, recovery rehearsal, operations and local demo.

External blockers: Cloudflare provisioning/deployment approval, email domain and credentials, Meta account/phone/templates/credentials, payment processor selection/credentials, merchant contracts and privacy/legal review. These do not block local implementation.

Evidence will be appended per milestone. The original handoff test checks packaging only; it is not product evidence.

M0: Foundation implemented. `npm run typecheck`, `npm run build`, `npm test` pass (2 tests, including real workerd/D1); dependency audit zero vulnerabilities after patched sharp/undici overrides. Initial GitHub import verified by identical tree SHA. Local persistent runtime and fixture seeds implemented. Browser acceptance scenarios will be added with the real UI in M4. No live deployment attempted.

M1: Merchant sessions, atomic single-use magic links, secure HttpOnly SameSite cookies, CSRF/origin checks, staff/owner authorization, service/resource/hours/blackout settings and tenant-scoped composite foreign keys implemented. Typecheck and all 3 tests pass; the M1 integration scenario exercises replay, expiry, forged/tampered tokens, logout/session expiry, CSRF, foreign IDs and transaction rollback. Live email remains unconfigured until M3 adapters. No public tenant registration/admin route.

M2: Atomic 5-minute D1 claims, signed expiring offers, UTC/local availability, offline appointments, bounded customer tokens, rotation, cancellation and reschedule rollback implemented. Typecheck and all 6 test scenarios pass. Forty simultaneous requests produced exactly 1 creation and 39 conflicts, 4 claims, 1 customer and no duplicate outbox records. Failed reschedules preserved the original claims. Stale configuration, invalid signatures, blackout, pause, horizon, foreign service IDs and expired tokens rejected. Casablanca transition coverage is queued for the final adversarial suite.

M3: Durable outbox/leases/backoff/attempts/alerts, mock providers, Resend and Meta adapters, encrypted tenant connections, neutral message rendering, consent/suppression and signed replay-safe receipt handlers implemented. All 9 scenarios pass; the focused delivery suite passes after receipt precedence and tenant-scoping hardening. Tests distinguish provider acceptance from delivery, exercise duplicate processors, retryable outage, final rejection/email fallback, uncertain submission, expired lease and production debug denial. Provider wire contracts remain fixture-only; real sender/template/account approval and delivered messages are BLOCKED.

M4: French mobile customer/merchant UI uses the Worker API exclusively, with no browser business-data storage. Real booking/self-service, day/week agenda, manual booking, attendance, services/staff/hours/blackouts, pause, customers, exports, metrics and message monitoring implemented. 10 API scenarios and 2 Chromium mobile E2E scenarios passed. Screenshots inspected at 360px. A real browser/Worker Casablanca timezone-data discrepancy was found and fixed: appointment display strings and local-time conversion now come from the Worker. Payment/loyalty workflow remains explicitly pending M5.

M5: Merchant-confirmed completed payments, integer 1%/2% credits/caps, FIFO redemption with in-person authority, immutable ledger/payment/refund history, proportional refund reversals, negative accounting balances, credit restoration and explicit lot expiry implemented. First eligible completed visit gets a neutral review prompt; no satisfaction gate or reward. Rebooking is opt-in and disabled by default. All 13 API scenarios and 3 mobile E2E scenarios pass, including real UI payment and partial refund. Live processor verification remains absent and explicitly null. M6 adversarial audit and operations gates remain open.
