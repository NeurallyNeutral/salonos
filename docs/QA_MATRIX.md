# M6 verification map

All database tests execute real local workerd and D1, not a map replacing application SQL. Provider HTTP fixtures are explicitly injected; no live Resend/Meta/billing call is claimed. Final counts and CI evidence are in STATUS.md.

| Requirement | Executable evidence |
|---|---|
| Single-use/expired/tampered auth, atomic consumption, cookies, roles, CSRF, origin | auth and adversarial tests |
| Cross-tenant mutations, privacy, CSV, absent public admin/state/debug APIs | auth, adversarial, workflows and operations tests |
| Forty public contenders; forty mixed manual/public contenders with duration/buffer overlap | bookings tests: one creation, 39 conflicts, exact claims |
| Concurrent cancel/reschedule, rotated/expired tokens, occupied-target rollback | bookings tests: one sensitive-token winner, consistent occupancy |
| Same-customer concurrency and per-booking consent email | adversarial tests |
| Closed hours, pause, blackout, stale offers, foreign IDs, horizon | bookings tests |
| Casablanca Ramadan fold/gap, explicit UTC and canonical Worker display | adversarial tests and browser workflows |
| Retry, duplicate processors, failed/uncertain sends, consent fallback, signed/replayed receipts | delivery and adversarial tests |
| Receipt arriving before/during send, terminal delivered state, no false fallback | providers and adversarial tests |
| Resend/Meta wire contracts and mock/disabled billing | providers tests; synthetic fetch only |
| Completion/payment requirement; 1%/2%, cap, duplicates, refund rounding, FIFO, expiry, negatives | loyalty tests |
| Neutral first-visit review, no satisfaction/reward gate, consent | loyalty tests and demo scenario |
| Retention race/current policy, erasure, unsubscribe replay/tenant scope | operations and adversarial tests |
| Restart, deleted schedules stay deleted, rotation/old-key retirement | restart and operations tests |
| Customer/calendar pagination, streamed CSV past first chunk | operations tests: 506 tenant records and a separate merchant |
| 360px booking, independent browser persistence, owner workflows, payments/refunds | Playwright product tests |
| Automated WCAG A/AA and keyboard focus | axe E2E; not complete manual accessibility certification |
| Restore ten tables, claims/FKs/payment/refund/loyalty/outbox | recovery rehearsal; local only, not live Time Travel |
| Credential patterns, forbidden artifacts, syntax/types/lockfile audit | safety, lint, typecheck and npm audit |

Audit fixes include transactionally rechecked retention, consent email snapshots, one-time fixture seeding, random stable unsubscribe links, re-encryption of all ciphertext stores, monotonic receipts, pagination, sanitized logs and cron cadence compatible with auth expiry.

Limits: no independent penetration test, production-scale soak test, complete manual screen-reader assessment, Arabic/RTL E2E, live providers, live backups or paging. Offset pagination can change while other operators edit; refresh to reconcile. CSV uses a creation cutoff/stable IDs but is an operational export, not a transaction-consistent database backup.
