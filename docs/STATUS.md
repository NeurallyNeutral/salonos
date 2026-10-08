# SalonOS status

Updated 2026-10-08. CODE_COMPLETE: NO. LIVE_PROVIDER_VERIFIED: NO. PILOT_READY: NO.

Baseline audit: the only working application endpoints are /health and a deliberately failing /ready. No application migrations, authentication, real booking, delivery or product tests exist. The reference Worker has unauthenticated tenant reads and non-atomic booking. The reference demo uses memory and browser fixtures. Both remain quarantined, outside the application build.

GitHub: NeurallyNeutral/salonos is private and initially empty (verified using the GitHub connector). Initialized a project-local Git repository because the inherited parent repository contains unrelated projects. Native Git credentials cannot access this repository; use the authorized GitHub connector for source publication. Never change repository visibility or permissions. No deployments are authorized.

Queue: M0 foundation and migration; M1 authentication/configuration; M2 atomic booking; M3 durable messaging; M4 French merchant/customer UI; M5 payment ledger/loyalty/reviews; M6 adversarial QA, recovery rehearsal, operations and local demo.

External blockers: Cloudflare provisioning/deployment approval, email domain and credentials, Meta account/phone/templates/credentials, payment processor selection/credentials, merchant contracts and privacy/legal review. These do not block local implementation.

Evidence will be appended per milestone. The original handoff test checks packaging only; it is not product evidence.

M0: Foundation implemented. `npm run typecheck`, `npm run build`, `npm test` pass (2 tests, including real workerd/D1); dependency audit zero vulnerabilities after patched sharp/undici overrides. Initial GitHub import verified by identical tree SHA. Local persistent runtime and fixture seeds implemented. Browser acceptance scenarios will be added with the real UI in M4. No live deployment attempted.

M1: Merchant sessions, atomic single-use magic links, secure HttpOnly SameSite cookies, CSRF/origin checks, staff/owner authorization, service/resource/hours/blackout settings and tenant-scoped composite foreign keys implemented. Typecheck and all 3 tests pass; the M1 integration scenario exercises replay, expiry, forged/tampered tokens, logout/session expiry, CSRF, foreign IDs and transaction rollback. Live email remains unconfigured until M3 adapters. No public tenant registration/admin route.

M2: Atomic 5-minute D1 claims, signed expiring offers, UTC/local availability, offline appointments, bounded customer tokens, rotation, cancellation and reschedule rollback implemented. Typecheck and all 6 test scenarios pass. Forty simultaneous requests produced exactly 1 creation and 39 conflicts, 4 claims, 1 customer and no duplicate outbox records. Failed reschedules preserved the original claims. Stale configuration, invalid signatures, blackout, pause, horizon, foreign service IDs and expired tokens rejected. Casablanca transition coverage is queued for the final adversarial suite.
