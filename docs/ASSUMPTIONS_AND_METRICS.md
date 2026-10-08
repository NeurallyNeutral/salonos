# Business-model hypotheses vs provable system metrics

## NOT validated
- That small salons will pay 990 or 1990 MAD monthly.
- That Instagram follower count predicts appointment volume.
- That SalonOS creates incremental customers rather than processes organically sourced bookings.
- That no-shows decrease because of reminders without a measured comparison.
- That merchants have capacity for more bookings.
- That clients will adopt 1–2% merchant store credit sufficiently to increase retention.
- That current WhatsApp app can coexist seamlessly with Cloud API for every merchant.

## Instrumented metrics
- `booking_created`, `booking_completed`, `booking_no_show`, `booking_cancelled`, `reschedule_completed`.
- Booking page impression/session count and conversion with transparent definition; reject bot traffic.
- Source/UTM preserved as claimed referrer, not proof of incremental acquisition.
- Customer first paid visit vs return visit in same tenant; deduplicate by normalized phone/account carefully.
- `payment_recorded` and `loyalty_issued` vs processor-verified receipts; reports label origin/verification.
- Notification `queued`, `provider_accepted`, `delivered`, `failed`, `suppressed`, each separately measured.
- Time saved: merchant-reported sample estimate unless instrumented; cost avoided is modeled, not actual accounting outcome.
- Founder support minutes per tenant/month, deployments/incidents, churn/cancellations and gross margin.

## Pilot economic model
Commercial strategy is deliberately undecided; code should support configurable plans. Loyalty credit is paid by merchant as discount, **not** SalonOS commission, and must be accounted for separately. Optional commission on attributable *new paid* customers is impossible to verify without payment integration or audit; no automated bill until contractual rules and reconciliation are agreed.
