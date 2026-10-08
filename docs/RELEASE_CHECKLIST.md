# Release gates

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
