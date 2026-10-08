# Codex repository instructions — SalonOS

You are the lead implementation engineer. Your task is to take this repo from a safe starter to a working, tested, pilot-ready SalonOS product, with minimal recurring founder operations. Work through `docs/CODEX_MISSION.md` and keep momentum without repeatedly asking routine design questions. Make sensible reversible choices, document them and write tests.

## Rules
- Treat `reference/worker_scaffold` and `reference/interactive_demo` as **unsafe and non-authoritative**. Do NOT deploy or silently copy their unauthenticated API/state model. Borrow UI layout patterns only after wiring them to the single backend.
- One live source of truth: D1. No fake browser localStorage for live bookings, owner state, loyalty balances, or analytics. A clearly labeled isolated demo mode may use fixtures.
- Tenant isolation must be server-enforced. Every merchant mutation derives `tenant_id` from a verified session, never client-supplied slug/tenant ID.
- Never expose real customer data via public APIs. No hardcoded secrets. Never silently perform external/deployment/billing actions.
- **GitHub access:** The owner authorizes Git operations *inside `NeurallyNeutral/salonos` only*: initial source import, branches, commits, pushes, issues, pull requests, CI and merges after checks. Keep the repository private; never change visibility or permissions. Do not modify any other repo. Never commit credentials, personal data or `.env` files. When cloud Git credentials are unavailable, provide an exact owner action instead of embedding a token.
- **Vercel is strictly owner-operated:** The agent must NEVER invoke Vercel API/CLI/connectors, link the repo to Vercel, create deployments/projects, configure automatic deployments, or trigger Vercel builds (even indirectly). The owner alone performs Vercel deployments due to account policy. Do not try to bypass this rule. Build locally and in mocks; prepare a manual Vercel handoff only if requested. Cloudflare staging or paid resources also require explicit owner approval before provisioning.
- Every booking creation, owner manual booking, cancellation, and reschedule must be atomically conflict-safe. Avoid SELECT -> INSERT race. Implement DB-enforced atomic slot claims or equivalent and stress test.
- All external messaging is consent-aware, separately idempotent, and observable. 'Queued' is NOT 'delivered'; retry transient failures; safely reconcile webhooks.
- Loyalty credit only after an **actual merchant-recorded completed payment**, never merely after booking. Maintain an append-only ledger and reversals; the platform does not hold money. `merchant_reported` != independently `verified` revenue.
- Google review prompts must be neutral and available to all eligible customers. **Never** reward reviews, selectively ask happy clients, or route unhappy clients away from public review opportunities.
- Build for `Africa/Casablanca` and other merchant time zones (including DST/Ramadan variations). UTC internal storage; time-zone-aware displayed and submitted times.
- Accessibility, mobile-first French UI; Arabic-ready i18n architecture. No unnecessary complexity or heavyweight SaaS dependencies.
- Features that add recurring manual labor are suspect. Do not write speculative CRM/AI/POS modules.
- When blocked by external credentials, implement a compliant provider adapter and mock fixture tests; mark the external live step BLOCKED. No pretending it was tested.
- Do not mark release complete until test and release gates all pass; never skip or weaken failing tests to get green status.

## Workflow
1. Inspect code and source documents. Update `docs/PROGRESS.md` with the baseline and work queue.
2. Implement milestones M0 -> M6 in order, submitting small commits/PRs when Git is configured.
3. For every milestone: implement -> run typecheck/tests -> inspect edge cases -> update progress/checklists -> proceed.
4. After implementation, do adversarial QA: double-book, replay, auth bypass, cross-tenant, outbound message failures, loyalty duplicates/refunds, improper reviews, DST, restart/persistence.
5. Finish with exact run/setup instructions, seed fixtures, test counts/results, known limitations, and separate `CODE_COMPLETE` and `LIVE_PROVIDER_VERIFIED` statuses.
6. If you cannot invoke external provider onboarding, account creation, or deployment, stop only those blocked activities. Continue unrelated technical tasks and provide precise user actions required.

Read: `docs/CODEX_MISSION.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/ARCHITECTURE.md`, `docs/LOYALTY_AND_REVIEWS.md`.
