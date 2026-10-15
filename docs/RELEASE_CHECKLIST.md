# Release gates

## V2 gates (2026-10-15)

- [x] V2 A–F implemented and tested milestones published on codex/v2-launch-kit.
- [x] Self-service identity, offering, publication, separate modes and safe previews implemented.
- [x] V1 booking/auth/delivery/loyalty protections preserved; catalog accounting and tenant privacy covered.
- [ ] Final G local suite, screenshots, recovery, discovery and performance results recorded.
- [ ] Final-head GitHub CI green and PR ready for review.
- [ ] Five independent human onboarding trials and physical-phone short demo validated.
- [ ] Chosen live providers, privacy, infrastructure, recovery and owner deployment gates approved.

[Owner actions and exact commands](V2_HANDOFF.md). Code completion never implies provider or pilot verification.

## Historical V1 gates

Authoritative evidence: [STATUS.md](STATUS.md). Source-control merge never authorizes deployment.

## Code gate

- [x] Final syntax/formatting, typecheck and bundle pass.
- [x] All API, Worker/D1, adversarial, provider fixture and restart tests pass without skips.
- [x] All mobile Chromium E2E and automated accessibility checks pass.
- [x] Isolated demo and expanded recovery rehearsal pass.
- [x] Dependency audit and tracked-source safety pass.
- [x] Implementation content verified on GitHub; full M6 CI succeeded. Any later PR-head commit must also pass before merge.
- [x] README, runbook, limitations and owner actions match the implementation.

CODE_COMPLETE requires all code gates, including required GitHub CI.

## External live gate — not authorized or executed

- [ ] Owner approves provisioning, spending, deployment and pilot data use.
- [ ] Separate Cloudflare staging/production D1, secrets and authenticated bootstrap.
- [ ] Real Resend sender/domain and signed delivered receipt to an opted-in recipient.
- [ ] Real Meta account/number/current version/approved templates and signed delivered receipt.
- [ ] Live scheduler, alerts, logs and failure escalation.
- [ ] Live Time Travel and independent export/import rehearsal; agreed RPO/RTO and restore authority.
- [ ] Merchant review link, loyalty terms, contracts and privacy/CNDP review.
- [ ] Commercial billing terms/provider approved if collecting subscriptions; otherwise collection stays disabled.
- [ ] Owner-approved smoke test, rollback and outage procedure.

LIVE_PROVIDER_VERIFIED requires actual chosen-provider evidence. PILOT_READY also requires approved privacy, operations and deployment gates. Mock acceptances satisfy neither. Vercel is strictly owner-operated; no deployment automation is configured.
