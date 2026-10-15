# Progress and evidence

V2 current state: `CODE_COMPLETE: NO` (final gates/CI pending); see [V2_PROGRESS](V2_PROGRESS.md). Historical V1: `CODE_COMPLETE: YES`, `LIVE_PROVIDER_VERIFIED: NO`, `PILOT_READY: NO`. Historical status at initial handoff: `SAFE_BOOTSTRAP_ONLY`.

2026-10-08 baseline audit: no product behavior implemented in root source; reference backends are unsafe/simulated and excluded from runtime. Project-local Git initialized; private empty GitHub repository verified. Native Git authentication unavailable; connected GitHub API available. See STATUS.md for the work queue and external gates.

- [x] M0 foundation: real local workerd/D1, migration/seed runner, build/typecheck and persistent demo launcher (2 tests passed)
- [x] M1 tenant/authentication core; typecheck and 3 test scenarios passed
- [x] M2 availability + atomic bookings; 6 scenarios passed including 40 simultaneous contenders
- [x] M3 reliable delivery + provider adapters; 9 scenarios passed, live providers BLOCKED
- [x] M4 merchant UI and truthful metrics; 10 API scenarios + 2 mobile browser scenarios passed
- [x] M5 loyalty + neutral reviews; 13 API scenarios + 3 mobile E2E scenarios passed
- [x] M6 implementation, adversarial QA, recovery, runbooks, local demo and full release CI passed

## Evidence

2026-10-08 M6: clean dependency install, syntax/type/build, source scan and diff checks passed. All 26 Node scenarios and 5 browser scenarios passed with zero failures/skips. Dependency audit reported zero vulnerabilities. Full two-merchant mock scenario, expanded ten-table recovery and handoff checks passed. Retention/receipt races, identity/consent snapshots, key retirement, pagination and concurrent public/manual/cancel/reschedule operations are covered. Recovery measured 43 ms snapshot and 2083 ms restore/verify on synthetic local data. Full GitHub CI run 37779647019 passed on M6 implementation head a91901fd73e80210720314a54cb09f6ed8a17c28; its tree matches local commit 251b7f4. Persistent localhost demo health/readiness and booking page returned 200. See STATUS.md for the evidence link and external gates.
Milestone commits are on `codex/pilot-implementation` and PR #1. Separate `CODE_COMPLETE` (local gates plus required CI), `LIVE_PROVIDER_VERIFIED` and `PILOT_READY`; exact final evidence is in STATUS.md and QA_MATRIX.md.

## External blockers
- [ ] Real Meta WhatsApp business assets, templates, permission and billing
- [ ] Cloudflare production account/database and deployed credentials
- [ ] Verified email sender/domain
- [ ] Pilot merchant data and contract
- [ ] Data/privacy legal review

No production credentials are part of this archive.
