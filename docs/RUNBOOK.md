# Operations runbook — for Codex to complete with tested procedures

## Local
`npm install; npm run db:local; npm run dev` then verify `/health` returns 200, `/ready` returns 503 until implemented. Once implemented, add seed command + browser E2E + demo walkthrough using local Worker and D1.

## Before production
1. Confirm staging and production D1 separation, backup/restore procedure and who owns credentials.
2. Set secrets through Cloudflare, never local source.
3. Read privacy/legal gates and obtain explicit owner approval for live personal data.
4. Confirm rate limits and quotas, provider billing exposure and opt-in.
5. Verify smoke checks and rollback plan.

## Incident classes
- Booking unavailability/collision: pause public bookings, keep owner manual calendar visible, inspect DB claims, restore with care.
- Meta outage: bookings still work, mark messages delayed, retry/outbox, use authorized email fallback only.
- Invalid merchant config: owner self-edits schedules, review audit log, don't write custom code.
- Bad release: revert release; destructive D1 Time Travel restore only after explicit impact review, because overwrite may lose legitimate newer bookings.

Document real RPO/RTO and escalation before paid pilot.
