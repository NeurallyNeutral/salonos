# Risk register

## 1. Merchant dishonesty
**Risk:** under-reporting completed appointments or revenue.
**Mitigation:** subscription billing does not depend on completion/revenue; status data is analytics only.
**Residual risk:** case-study quality can still be affected by bad data.

## 2. Attribution overclaim
**Risk:** a customer discovers the merchant elsewhere but books through our system.
**Mitigation:** call this “booked through the system,” not “acquired by us.” Track sources, but do not equate routing with acquisition.

## 3. WhatsApp policy/account risk
**Risk:** templates can be rejected; accounts can be rate-limited or suspended; policies can change.
**Mitigation:** merchant owns WABA, uses approved utility templates, collects required consent, and pays Meta directly. Email reminders remain a fallback.

## 4. WhatsApp onboarding friction
**Risk:** connecting Meta business assets can be annoying for tiny merchants.
**Mitigation:** first 5 can be manually onboarded. Build embedded signup only after proof.

## 5. Free-tier ceilings
**Risk:** Cloudflare/Resend free limits can be exceeded.
**Mitigation:** central usage telemetry and hard alerts; upgrade before limits. Costs remain tiny relative to even one subscription.

## 6. Serverless vendor dependency
**Risk:** Cloudflare outage or policy change.
**Mitigation:** SQL schema and TypeScript app are portable; maintain daily export/backup path. Oracle/VPS remains fallback.

## 7. Double booking
**Risk:** race condition when two customers choose same slot.
**Mitigation:** slot uniqueness constraint/transaction strategy and recheck availability at write time.

## 8. Reminder failure
**Risk:** provider outage/token expiration/template change.
**Mitigation:** store delivery state; retry idempotently; email fallback; dashboard alerts only for persistent failures.

## 9. Bad merchant schedule data
**Risk:** merchant forgets to block holidays or changes hours.
**Mitigation:** self-service blackout dates and emergency “pause bookings” toggle.

## 10. Personal data/privacy
**Risk:** names, phones and booking history are personal data.
**Mitigation:** minimize fields, publish privacy terms, encrypt secrets, restrict tenant access, set retention/export/delete controls.

## 11. Support creep
**Risk:** every merchant asks for custom changes.
**Mitigation:** standard product only. Custom requests go into roadmap or paid custom work; never silently become support obligations.

## 12. Billing collection
**Risk:** monthly manual chasing destroys zero-work goal.
**Mitigation:** require standing order/recurring payment when feasible; otherwise invoice 3 months in advance while quoting monthly equivalent. Automate billing before scaling beyond first 5.
