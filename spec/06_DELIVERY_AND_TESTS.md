# 06 — Acceptance matrix, negative tests and owner handoff

## Exit gates (no synthetic green = sales-ready claim)
These are required to accept code. Owner visually inspects separately.

### Sandbox interaction tests
- D01 /demo root loads choice; salon & boutique cards both selectable. Selected mode persists through tab switching.
- D02 Merchant demo email `a@exemple.test` -> Email tab visibly shows a simulated new message -> verify -> setup. Invalid email cannot progress; Back preserves; Restart clears; no writes/network except local static asset GET.
- D03 Salon sandbox service + date/slot + synthetic contact -> confirmation -> identical event shown as `10:30 · Soin du visage · Cliente de démonstration` in merchant Today; no duplicated event after revisiting.
- D04 Boutique sandbox item+variant+quantity -> demand receipt (not purchase) -> identical inquiry shown in merchant view; no fake payment.
- D05 Switch salon -> boutique resets incompatible event; browser Back/Forward restores scene; page reload follows documented reset/restore rule consistently.
- D06 Static standalone build serves root /, /demo/, /demo/merchant/, /demo/customer/, /client.html, /merchant.html with no Worker/D1 and no 404.
- D07 All 360/390/768/1440 have no horizontal overflow, readable input labels, reachable footer; if not testable without browser mark blocked.

### Real app functional regression
- R01 Real `/signup` request shows dedicated pending view **without** local `/inbox` link. Its real success requires server token verification. Existing localhost fixture remains separately restricted.
- R02 New owner salon mode -> identity -> offering/hours -> preview -> publishing; reload after every step preserves server draft. Wrong slug, no phone, invalid time, repeated publish errors are human-readable and retain input.
- R03 New owner boutique mode -> 1 product -> preview/publish -> merchant opens received inquiry in separate browser context; only same tenant sees it.
- R04 Real salon customer selects exact service -> available slot -> enters details -> confirmation -> merchant agenda retains booking after restart; double-booking conflict remains atomic.
- R05 Real boutique customer selects exact item/variant/quantity -> inquiry confirmation -> merchant can search by customer or item and page to older records.
- R06 Manual booking today uses tenant-local date and chooses future time only; no default tomorrow for walk-in.
- R07 Merchant-reported payments, refund reversal, 0/1/2% ledger unchanged; review prompts neutral; no rewards for review.
- R08 Real signup disabled in remote review unless owner enables verified provider. Never send mock emails or display local inbox on remote hostname.
- R09 Non-owner users denied owner-only operations; cross-tenant access cannot leak booking/catalog/payment data.
- R10 Real customer storefront contains no `Espace professionnel` or `Créer ma vitrine` nav.

### Visual review (OWNER, not GLM)
At 390x844 and 1440x900 collect screenshots of:
- Entry salon/boutique selector; 2 demo email states, customer salon service selection and confirmation, boutique selection and inquiry; merchant Today and merchant inquiries; real signup pending page; real setup identity and publication.
Compare actual UI vs spec/01+02. On 390 phone: clear one primary action, no card overflow, no horizontal tabs/clipping, no old rotated paper-card template, no giant letter-only product art, no fake reviews/photos. Annotate P0/P1 visually before code acceptance.
Small-font exceptions must be reviewed rather than hidden in a passed test. Full keyboard/focus/reduced-motion checks required when browser testing becomes available.

## Exact commands (in local checkout)
```bash
npm run build
npm run check
npm run test:handoff
npm run test:safety
npm run test:recovery
npm run demo:scenario
npm run demo:v2
# Only if browser runner exists and owner authorizes:
npm run test:e2e
```
`npm run demo` starts http://localhost:8787 on same machine. `/dev/inbox` is localhost development-only; do not remove guard. If source transferred as ZIP and no local .git, some source-safety scripts may need owner-created local-only git init, NOT a remote; document any affected test as blocked until repaired.

## Delivery artifact contents
- Exact edited file list, routes, and deterministic test output.
- `spec/IMPLEMENTATION_LOG.md` with milestone checkboxes and limitations, including tests NOT run.
- Notes for owner: localhost URLs (actual and demo), static build directory, separate private-review example template; do not fill real IDs or credentials.
- Diff/patch or local git commits (no remotes), no external push.
- A **GO-for-owner-visual-review** label only when reachable functional tests passed, not a "production-ready" or "outreach-ready" claim.

## Background and basis (for owner; not a browsing task for GLM)
- Fresha's client booking process: https://www.fresha.com/help-center/knowledge-base/online-presence/102398-learn-how-clients-book-appointments-online
- Shopify merchant onboarding guidance: https://shopify.dev/docs/apps/design/user-experience/onboarding
- Baymard inline form validation: https://baymard.com/research-articles/inline-form-validation
- Fontsource Instrument Serif: https://fontsource.org/fonts/instrument-serif/about
- Fontsource Manrope: https://fontsource.org/fonts/manrope/about
Implementation requirements are already codified above. GLM has **no permission or reason to browse** these sites.
