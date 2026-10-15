# Optional messaging and Instagram feasibility

Decision, 2026-10-15: keep the V1 official Meta WhatsApp and Resend adapters. Ship customer-initiated wa.me contact, truthful readiness and local fixture checks. Instagram automation and the OpenReply runtime are DEFERRED. No external account, connection, send or deployment was performed.

The [OpenReply primary repository](https://github.com/diwenne/openreply), inspected read-only on 2026-10-15, describes Instagram comment/private-reply automation and an independently hosted application requiring a database, queue and send worker. Bringing that operational stack into SalonOS is unnecessary for booking and catalog launch. No OpenReply source was copied; future copying requires retaining MIT attribution.

The [Meta Embedded Signup collection](https://www.postman.com/meta/whatsapp-business-platform/collection/du6gzjv/embedded-signup) and [Meta Instagram collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) identify separate integrations. Their rendered documentation was limited in this environment; permissions, current API versions, per-account restrictions, coexistence and pricing are NOT verified by this spike. No hardcoded current-price or approved-permission claims are made.

## Narrow Instagram follow-up gate

Before any runtime adapter, owner must select an official login flow and confirm its current basic/account, message and comment permission scopes; app review/access level; eligible professional accounts; messaging windows; private-reply limits; webhook fields/signature/raw-body verification; token lifetime/revocation and per-merchant account ownership. None are currently granted to SalonOS.

Proposed future boundary: a tenant-owned professional account maps to one tenant; signed provider event ID plus account ID deduplicates an incoming event; an explicit merchant-enabled rule may propose a permitted reply through a durable outbox. No arbitrary client-supplied tenant/account routing. No scraping, passwords, cold DM, broadcasts or cross-account inbox. Store minimal event identifiers with bounded retention, encrypted credentials and erasure/revocation support. First implement fixture contracts; require separate owner approval before a live connection.

## Risks and owner dependencies

| Area | Current state | Required evidence |
| --- | --- | --- |
| Permissions/app review | BLOCKED, not granted | Selected scopes and approved test account |
| Conversation routing | Deferred design | Account ownership and cross-tenant event tests |
| Webhooks/replays | V1 WhatsApp tested with fixtures | Instagram raw-body/HMAC and replay tests before adapter |
| Pricing/coexistence | Unverified | Owner-reviewed current Meta terms and merchant cost disclosure |
| Retention/erasure | V1 plus V2 customer lifecycle | IG-specific payload inventory and delete callback |
| Hosting/runtime | No OpenReply installed | Revisit only with merchant evidence of value |

## Readiness semantics

DISCONNECTED means no active connection. TESTING means a mock fixture check or configured connection without independent delivery proof. ERROR means failed/uncertain sends require attention. CONNECTED requires a current enabled live provider plus a delivered non-mock receipt after that connection was configured. Provider acceptance alone never qualifies. Revocation wipes encrypted tenant connection material and suppresses eligible pending jobs; already accepted/uncertain outcomes remain observable. Instagram stays DISCONNECTED and deferred even after a fixture check.

Local fixture checks send zero messages, store no tokens and cannot run in production. Publication never requires Meta. The global email sender needed for verified sign-in is separate from optional merchant customer messaging.
