# SalonOS — GLM 5.3 implementation handoff

This branch is a **clean, source-complete implementation workspace** derived from the tested V3 Worker/D1 application. **It is not a deployed SaaS.** The frontend design and guided demonstrations are being replaced according to a fixed contract.

**Start here:** [spec/00_START_HERE.md](spec/00_START_HERE.md). Then read `AGENTS.md` and the numbered specifications in order. There are no other active product/design missions.

## Architecture
- Real application: Hono/TypeScript on a Cloudflare Worker, D1, optional R2, authenticated tenant-scoped merchant APIs.
- Local run: `npm ci`, `npm run demo`; browse `http://localhost:8787` on the same computer. Development contains fictional data and a localhost-only email fixture.
- Actual customer: `/shop/atelier-atlas`, `/shop/maison-sable`; booking `/book/atelier-atlas`.
- Actual merchant: `/login`, `/signup`, `/dashboard`, `/setup`, `/launch`.
- Guided sandbox: `/demo/merchant` and `/demo/customer` today; implement unified `/demo` landing and its design contract. These are NOT real accounts, deliveries or payments.

## Guardrails
- No external deployment, real messages or charges.
- Keep `src/`, `migrations/`, `fixtures/`, `tests/`, and the Worker build. They are the full working codebase.
- The original history remains recoverable on the source branch; old prompts, unsafe reference scaffolds and conflicting progress reports have been excluded from this handoff snapshot.
- Owner supplies the local tree under `~/lab/build/active/salonos`. Coding model must not receive GitHub credentials or a git remote.

## Acceptance
`npm run check`, `npm run test:handoff`, `npm run test:safety`, `npm run test:recovery`, and (if locally supported) `npm run test:e2e`. Then owner visually accepts every screen at desktop and mobile sizes. Tests alone are not proof of design quality.

**Release state:** baseline backend locally tested; guided demo design and product frontend not yet owner-approved; real providers and public deployment unverified.
