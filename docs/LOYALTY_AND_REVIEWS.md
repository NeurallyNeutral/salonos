# Loyalty credit and review prompts — precise rules

## Loyalty is a merchant-funded discount, not a SalonOS payment account
Default 1% or 2% reward **on eligible merchant-recorded actually paid amount**, configurable per merchant. For MAD, represent money in *integer centimes* and rates in basis points (100 bps = 1%; 200 = 2%). Example: 120.00 MAD paid, 1% = 120 centimes = 1.20 MAD credit. Use deterministic integer rounding down for each eligible transaction. Avoid floats for balances.

Transaction process:
1. Merchant marks appointment completed.
2. Merchant records paid amount (and optional internal invoice/receipt reference). It is labeled merchant-reported, not verified by processor.
3. One idempotent earn event per original payment ID; worker can retry safely.
4. Customer receives opt-in status/credit message through approved channel once eligible.
5. At next eligible visit, redemption applies merchant-funded credit only to this merchant's next bill; merchant confirms authorization with one-time link/OTP or in-person identity verification. Never show a customer's full balance to anyone who only knows their phone number.
6. Refund/payment correction: append reversing entries, including proportionate earned credit reversals and redemptions if needed; never silently mutate ledger history. Negative accounting balance handling must be documented and tested.
7. Merchant settings: enabled, rate, cap per transaction, min redeem, expiry and eligibility/exclusions (legal review required). Every adjustment auditable.

### Anti-fraud/ambiguity
Separate `booked_value`, `merchant_reported_paid_value`, `processor_verified_value` (null unless integrated). Do not award points from booking value. Handle partial payment/refunds, duplicate processing, customer identity merges, cross-tenant identity conflict, deleted customer account. Neither merchant nor SalonOS can redeem credit without a customer authorization step. Do not imply SalonOS custody of fiat money.

## Reviews
Post-visit invite can link to the actual business Google review page for **all eligible completed first-visit customers** (or all visits if configured); same neutral message regardless of satisfaction, no 'happy only' filter. No reward/discount/loyalty credit for leaving a Google review and no requiring a positive star rating. Send request only to recipients who may lawfully receive the message via that channel, and obey templates.

Suggested French: `Merci pour votre visite chez {commerce}. Si vous souhaitez partager votre expérience honnête, vous pouvez laisser un avis ici : {lien}. Tous les retours sont les bienvenus.`

Google rules explicitly prohibit incentivized reviews and selectively soliciting positive reviews. See https://support.google.com/business/answer/7400114 and https://support.google.com/business/answer/16816815 .

## Distinct purpose
Loyalty = encourage repeat visits and quantify returning customers; review prompts = neutral customer feedback; never tie their incentives, and do not promise a measured increase without a real pilot comparison.
