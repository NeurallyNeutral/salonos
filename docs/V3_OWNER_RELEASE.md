# V3 owner-operated release handoff

Status on 26 October 2026: `CODE_COMPLETE: NO` until all final local and CI gates pass. `LIVE_PROVIDER_VERIFIED: NO`. `REMOTE_PRIVATE_REVIEW_VERIFIED: NO`. No live deployment or external messages were performed by Codex.

## Build and local review (Windows CMD)

```cmd
cd /d C:\Users\User Ob\Downloads\SalonOS_V3_UX_Release
npm ci
npm run check
npm run test:e2e
npm run demo
```

Open `http://localhost:8787/shop/atelier-atlas` and `/shop/maison-sable` for synthetic real-product fixtures, `/signup` for actual local verification through the localhost-only fixture inbox, `/dashboard` for the merchant workspace, and `/demo/merchant` or `/demo/customer` for static guided stories. The latter two use deterministic fictional scenes, have no API calls and never create bookings or payments. The standalone output is `dist\guided-demo`; its entry points are `demo\merchant\index.html` and `demo\customer\index.html` after serving that directory at a web root.

## Private Cloudflare review, owner action only

1. In your Cloudflare account, create an **isolated** review D1 and a review hostname. Configure Cloudflare Access for the **entire hostname and every path**, exact tester email allowlist, default deny and short sessions. Confirm an unauthenticated browser gets Access denial before any Worker is routed there. Keep the Worker route disabled until this check. Never put the mock inbox or fixture test endpoints on the public internet.
2. Use synthetic data only. Do not copy the local `.wrangler` directory or production data. Decide whether reviewers need login/signup. If so, configure an approved real test mailbox and Resend sender/API key for one-time login mail; this has **not** been verified here. Keep `SIGNUP_ENABLED=false` unless you explicitly authorize new test accounts and approve sender limits. Leave WhatsApp and other external messaging disabled. The optional R2 `MEDIA` binding requires separate owner approval; without it image upload fails closed.
3. Copy `wrangler.private-review.example.toml` to `wrangler.private-review.toml`, replace every `CHANGE_ME` with your isolated resource values, and review the hostname, D1 ID, Access policy and `APP_BASE_URL` together. The example is intentionally undeployable. `wrangler.toml` remains local-only with a placeholder D1 ID and localhost URL; **never deploy with that file**. `ENVIRONMENT=production` denies `/dev` fixture routes at the remote hostname.

Only after your Access and cost review, these are the Windows CMD commands for **you** to run:

```cmd
cd /d C:\Users\User Ob\Downloads\SalonOS_V3_UX_Release
copy wrangler.private-review.example.toml wrangler.private-review.toml
notepad wrangler.private-review.toml
node scripts\verify-private-review-config.mjs wrangler.private-review.toml
npm run build
npx wrangler secret put APP_SECRET --config wrangler.private-review.toml
npx wrangler d1 migrations apply DB --remote --config wrangler.private-review.toml
npx wrangler deploy --config wrangler.private-review.toml
```

Generate a unique random `APP_SECRET` of at least 32 characters. Do not put it in CMD history, source or the TOML file. The deploy command is for the owner; Codex has not run it. The optional real login provider also needs owner-supplied `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_PROVIDER=resend`, and approved `SIGNUP_ENABLED` in the review environment. Do not enable these until approved. Confirm `/ready`, login, Access denial/allow and disabled `/dev/inbox` using the remote hostname before sharing it.

## Standalone guided demos, owner action only

The demo build needs no D1, Worker, provider key or server function. From an owner-linked existing Vercel demo project, use Windows CMD:

```cmd
cd /d C:\Users\User Ob\Downloads\SalonOS_V3_UX_Release
npm run build
cd dist\guided-demo
vercel deploy --prod
```

If this directory is not already linked to the existing demo project, the owner must run `vercel link` here and select the intended **existing** project before `vercel deploy --prod`. Check the resulting HTTPS `/demo/merchant/` and `/demo/customer/` paths. Codex must not perform Vercel actions or trigger a build there.

## Limits and release gates

- The real product uses Worker/D1. The guided demos use no backend. A simulated email is never authentication.
- Real email/WhatsApp delivery, Cloudflare Access, R2, provider costs, production D1 recovery, physical-phone and independent human usability remain unverified. The platform does not process payments; merchant reports are not bank verification.
- Review the PR and final-head CI. Do not merge into `main` or publish the real app until separate owner approval and required gates pass.
