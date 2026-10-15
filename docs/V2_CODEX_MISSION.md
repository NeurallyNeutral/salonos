# Codex implementation mission — SalonOS V2 Launch Kit
Read AGENTS.md, docs/V2_LAUNCH_KIT.md, docs/V2_OPENREPLY_RESEARCH.md, docs/V2_GTM_DISCOVERY.md, docs/STATUS.md and docs/RELEASE_CHECKLIST.md first.

**Existing V1:** PR #1 on codex/pilot-implementation reports CODE_COMPLETE=YES, LIVE_PROVIDER_VERIFIED=NO, PILOT_READY=NO. The V2 kickoff branch codex/v2-launch-kit is based on V1. Preserve V1 migrations, security model and acceptance tests. Avoid merging unfinished work into main. Don't modify V1 PR without need. Tests and documented regressions are mandatory.

## Work sequence / deliverables
V2-A: Inspect actual existing code and test suite. Write a delta/spec checklist in docs/V2_PROGRESS.md. Document decisions/risks and ensure no outdated V1 scaffold is inadvertently used. Run baseline npm ci, npm run check, npm run test:e2e, npm run test:recovery. Report exact evidence.
V2-B: Implement product-mode templates `appointments` and `catalog_inquiry`, tenant feature flags and server validation. Implement catalog inquiry without adding ecommerce payments. Keep source-true D1 events; all states tenant scoped. API and mobile browser tests.
V2-C: Merchant first-run wizard, minimal viable tenant self-provisioning (verified owner, strong anti-abuse), draft preview, site publication, link/QR generator, branded mobile responsive template options, asset provenance/upload safety, slug security, pause/unpublish. Add resume/failure paths, seed fixtures and time-to-publish instrumentation.
V2-D: Shared merchant retention layer: config loyalty 0/1/2%, neutral Google review prompts only after eligible completed visits, truthful conversion/source metrics, customer WhatsApp click-to-chat as fallback. Make automatic WhatsApp unavailable until official Meta onboarding and approvals. No simulated delivery success in production.
V2-E: Mock connector readiness/progress UX and optional OpenReply/IG integration feasibility spike (docs + tests). Do not insert entire OpenReply stack or deploy any external services. Build only a narrow tested adapter if technically justified and approved; otherwise leave explicitly deferred. Preserve Meta Cloud API for WhatsApp.
V2-F: Separate discovery lead schema/import/scoring and a dry-run batch with synthetic candidates; NO Instagram scraping or unsolicited outbound. Optional human-review queue if it doesn't bloat launch build.
V2-G: Demo setup: polished fictional appointments and retail storefront each with corresponding merchant views; isolated demo fixture DB and prospect-safe share previews. Full mobile E2E, security, no-data-leakage and performance gate. Update ops and handoff docs with precise owner release actions. Only owner may deploy; do NOT touch Vercel, provision live cloud infrastructure, send actual messages or incur costs.

## Acceptance criteria
1. First-time merchant can create account, configure either mode and publish, no founder involvement (aim median <=10 min verified by 5 users).
2. Customer completes booking or inquiry on phone; relevant merchant sees it after browser restart/in separate browser, correct timezone, tenant isolation.
3. All V1 tests green incl 40-way booking conflict; all new API, mobile E2E, consent, auth and publication/abuse tests green.
4. No Meta connection required to publish site + wa.me link; UI transparently shows unconnected automation features.
5. No real identity/brand impersonation, default demo metrics labeled synthetic; no demo PII in real tenants.
6. No real WhatsApp auto send, auto outreach, subscription charge or external deployment.
7. Versioned documents and CI evidence, branch commits and PR. Report code complete separately from live integration & pilot readiness.

## Autonomy
Continue implementing locally, committing and pushing to codex/v2-launch-kit as milestones pass. Open a reviewable PR when implementation is tested. Use GitHub freely **within NeurallyNeutral/salonos**; do not change repo permissions or privacy. Don't silently merge PR #1 into main, rebase away unfinished work, or weaken tests. If a live/paid/approval operation is needed, mock it and record it as an owner blocker while continuing other work. Owner-alone Vercel policy is absolute.
