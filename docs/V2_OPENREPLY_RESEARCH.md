# OpenReply / Meta decision record — 2026-10-15
Research: https://github.com/diwenne/openreply (MIT).

## Verified scope
OpenReply is a self-hosted ManyChat-style **Instagram** comment-to-DM / keyword DM / Story response and inbox product built on the official Meta **Instagram** API. It is NOT a WhatsApp Cloud API onboarding or booking-reminder replacement. Its stack as currently described: Next.js, PostgreSQL, Redis, separate send worker and connected Instagram Business/Creator account. Can use own Meta app or optional paid Instagram connection provider Zernio. Running a separate OpenReply instance per merchant would multiply infrastructure, maintenance and onboarding.

## Decision
- Do NOT add OpenReply runtime as required infrastructure.
- Maintain SalonOS native WhatsApp provider abstraction and official Meta Cloud API adapter from V1.
- Instagram DM integration is optional and isolated behind provider interfaces, capabilities and explicit merchant consent. If valuable, compare calling into a separately hosted shared instance vs implementing only narrowly necessary webhook/keyword/reply flow under authorized official APIs. No direct code copying without respecting MIT attribution.
- Day-1 merchant messaging defaults to `https://wa.me/<business phone>` initiated by the customer, alongside booking/lead form; that works without WhatsApp API approval but does **not** enable automated reminders or chatbot/inbound sync.
- Phase 2 official WhatsApp Embedded Signup: evaluate Tech Provider/app review permissions, number/account coexistence, templates, per-message pricing, webhook receipt proof and merchant-billed costs before exposing as self-serve. Do not assume existing WhatsApp Business mobile app continues to function unchanged.
- Optional IG automation can be offered only after merchant connects an eligible professional account, permissions are approved, and actual events are tested.
- Every connector must have a clear DISCONNECTED/TESTING/CONNECTED/ERROR state, audit, per-tenant encrypted tokens, revocation, idempotent event handling and no ghost-success UI.

## Primary sources
OpenReply repository: https://github.com/diwenne/openreply
Official Meta WhatsApp API/Embedded Signup collection: https://www.postman.com/meta/whatsapp-business-platform/collection/du6gzjv/embedded-signup
Meta WhatsApp Business Platform: https://www.postman.com/meta/whatsapp-business-platform/overview
Meta Instagram API: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
Meta Tech Providers: https://whatsappbusiness.com/partners/become-a-partner/

## Agent research task
Before coding Instagram integration: document Meta scopes, permissions, Webhooks, app review status, per-account limitations, ownership/conversation routing, pricing, data-retention/erasure and a risk register. Build fake provider adapter and tests first. Do not deploy OpenReply or grant external connection without owner approval.
