# Engineering decisions

1. Keep Hono, Workers and D1. Reference code is archived documentation, never imported into runtime. Implement M0–M6 in that order with separate tested commits.
2. Local runtime uses Cloudflare Miniflare/workerd and its real D1 binding, with a persistent local demo and isolated test databases. Docker is unnecessary. Runtime source contains no Node APIs.
3. A small French browser application talks exclusively to the Worker. Assets are bundled as text; no frontend framework or second backend. Locale strings are centralized for later Arabic translation and RTL.
4. Availability enumerates UTC five-minute cells and checks their merchant-local calendar representations. Clients submit an explicit UTC instant and a signed expiring offer; repeated local times remain distinguishable by UTC offset. Configuration revisions invalidate stale offers at commit time.
5. D1 batch transactions and unique occupancy cells prevent overlap. Optimistic booking revision guards serialize cancel/reschedule/attendance; failed transactions retain old claims. Server-authenticated sessions determine every merchant tenant ID.
6. Payments are merchant-reported unless independently confirmed by a processor. The platform never holds funds. Loyalty is a merchant discount ledger; billing is disabled until separately configured and authorized.
7. External delivery cannot generally guarantee exactly once across a network timeout without provider idempotency. Resend uses stable keys; uncertain WhatsApp submissions must be reconciled instead of blindly resent. Queued, accepted and delivered remain distinct.
8. GitHub connector publication is used because native Git lacks credentials. Match Git tree hashes to verify identical content; local and API commit IDs can differ. Only NeurallyNeutral/salonos is authorized. Initial tree eafd072f49d6fd4a56a8b586e4579bf9e599e8d8 matches GitHub commit 8d5999cc1120bb6ba08d952ded1d2dc1f31da169.

References checked 2026-10-08: [D1 transactional batch](https://developers.cloudflare.com/d1/worker-api/d1-database/), [local D1](https://developers.cloudflare.com/workers/testing/miniflare/storage/d1/), [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/). Source schema and executable tests remain authoritative for implemented behavior.
