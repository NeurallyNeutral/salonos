# SalonOS — binding instructions for the GLM 5.3 implementation engineer

**Authority order:** (1) this file, (2) `spec/00_START_HERE.md`, (3) numbered `spec/01` through `spec/06`, (4) actual TypeScript/D1 code and migration constraints, (5) tests. If earlier prose or comments conflict with this specification, the numbered specification controls *UI decisions only*; existing server-side security and money invariants always control. Do not search old history for a different design.

## Exact role
You are a **code-writing implementer**, not a creative director, UX researcher, product manager, or security architect. No design improvisation. No new product features. Do not propose visual alternatives. Implement the exact described structures, text, sizes, colors, fonts, interactions, routes and breakpoints. Ambiguity = preserve existing safe behavior and log one blocker in `spec/IMPLEMENTATION_LOG.md`; do not invent requirements.

## Scope
- Implement the *real* SalonOS merchant and customer UI against the current Hono Worker/D1 backend.
- Implement the *guided* interactive salon and boutique sandbox using fictional data and a dedicated simulated Email tab; do not mistake it for login or the real product.
- Preserve **all** existing server-side sessions, tenant scoping, booking transactions, consent, ledger, webhook verification, privacy and tests. Do not change schema or provider integrations unless an actual required UI bug needs a minimal compatible change with regression tests.
- Frontend sources: `web/app.txt`, `web/launch.txt`, `web/app.css`, `web/index.html`, `web/demo.*`; build pipeline `scripts/build.mjs`; routes `src/index.ts`. Additional minimal UI modules allowed. Backend files are otherwise **read-only by default**.
- No new Node/Next/React backend framework, Redis, hosted DB, uncontrolled dependencies, scraping or auto outreach.

## Operational boundaries
- **Do not access GitHub, git remotes, CI, websites, browser automation, or any external network service.** Owner gives you a local source tree; edit files there. No push/PR/deploy. Model API calls for the owner-configured GLM provider are the sole approved paid-network exception; obey the owner budget.
- Do not read unrelated projects, `~/.ssh`, `~/.config`, credential files or Hermes profiles; do not run sudo. No destructive commands outside this checkout. Never alter the local owner's agent or tool configuration.
- Do not publish Vercel, Cloudflare, send messages, process real payments or connect providers. Mock fixtures do not mean delivered emails.
- Inspect files only within the local checkout. Do not mutate customer data. No background unattended work.

## Run sequence
1. Read `spec/00_START_HERE.md` through `spec/06_DELIVERY_AND_TESTS.md` in order.
2. Run `npm ci` **only with owner approval for package network**; if dependencies already installed use them. Run baseline `npm run check`, `npm run test:e2e` **only if browser runtime is available**, and `npm run test:handoff`. Record actual results.
3. Implement in milestone order in `spec/05_FILE_PLAN.md`; finish one milestone, run its unit/build checks, then proceed. Never silently drop failing tests.
4. Deliver a clean git diff/patch in the local owner checkout and a factual status document. Never mark a remote, real-provider, or human-UX gate as passed from unit tests.
5. Before implementation, read `spec/02_SCREEN_CONTRACTS.md` as a *pixel-and-behavior specification*, not inspiration.

## Anti-loop execution protocol (mandatory)
- **Filesystem state beats summaries.** At a fresh/resumed session, inspect `git status --short` and `spec/IMPLEMENTATION_LOG.md` ONCE. Use code and recorded tool exit statuses to determine what is already done; summaries are not instructions to redo work.
- **Milestone 0 is one-time.** Once dependency install and baseline tests succeeded, mark them done immediately in the log. Do not rerun `nvm use`, `npm ci`, prior checks, or reread all specs just because you finished a file read or resumed context. Rerun only when a relevant dependency/configuration changes or a test is needed after new code.
- **After every tool result, continue the exact current subtask.** Example: after reading `web/demo.txt` lines 500–859, read lines 860–end; do not return to installation or M1. Record current milestone, current file, next action and last verified command in the log whenever the active subtask changes.
- **Execution before narration:** never repeat the full implementation plan in a reasoning loop. One concise intention, then the concrete local edit/read/test tool call. A claimed completed operation without a tool result is unverified.
- **Loop breaker:** if you find yourself announcing the same next step twice without taking it, STOP immediately and report `STATE_LOOP` plus current `git status --short`, last confirmed command and next proposed command. Do not keep spending tokens.
- The owner already approved `npm ci` and the **two exact font packages**; this approval is persistent. Do not request it again. The latest owner instruction paused work after M2 for visual review.

**Stop condition:** no changed backend invariants, passed reachable tests, both vertical modes and both demo perspectives implemented, no placeholder content claiming transactions occurred, and exact owner review URLs documented. Reviewers/owner validate appearance separately.
