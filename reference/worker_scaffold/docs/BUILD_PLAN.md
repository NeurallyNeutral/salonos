# Build plan

## V0 — demo (1–2 focused build sessions)
- tenant seed
- Baddie Spot-style branded page
- services
- availability
- create booking
- simple merchant booking list
- confirmation screen

Goal: something showable on a phone.

## V1 — first live pilot
- magic-link auth
- reschedule/cancel token
- reminder cron
- Resend email
- Meta WhatsApp utility templates
- source tracking
- statuses
- basic analytics
- CSV export
- privacy/terms pages
- pause-bookings toggle
- audit log

## V1.1 — hardening after first merchant
- retries/idempotency
- tenant access tests
- slot race tests
- rate limiting
- backup/export automation
- operational alerts

## V2 — productize after 3–5 merchants
- self-serve onboarding wizard
- Meta Embedded Signup
- subscription billing
- plan enforcement
- custom domains
- multi-staff UI
- public marketing site
- case-study gallery

## Stop conditions
Do not build V2 before at least one merchant uses V1 in production and at least three real merchants agree the problem is worth paying for.
