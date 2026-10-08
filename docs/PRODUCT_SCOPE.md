# Product scope and decisions

## Essential customer flow
Click salon link (Instagram/WhatsApp/Google/QR) -> service/price/duration -> available staff/slot -> name + phone + necessary consent -> confirm -> manage link -> confirmation and reminders -> attend -> post-visit credit + unbiased review invitation.

## Essential merchant flow
Login -> configure services, resources, hours and closed dates -> share booking link -> accept online and manually entered WhatsApp/walk-in appointments -> mark visits and paid amounts -> credit loyalty/handle redemption -> see calendar, reminders, operating metrics -> update own settings or pause booking without SalonOS operator.

## Operator flow
Private restricted operator login -> provision tenant and service plan (billing not active yet) -> health monitoring, anonymized delivery health, support alerts -> export/backup/restore under privacy and audit controls. No default ability to read all customer PII without explicit audited break-glass authorization.

## Standardized, not custom
One codebase with per-tenant branding and configuration. No per-salon bespoke themes. Build a reusable, mobile-first booking product. Emergency pause is mandatory. Billing tiers configurable later.

## Explicitly parked
AI agent, native applications, marketplace/discovery, POS integration, inventory, payroll, affiliate marketplace, complex broadcast CRM, customer cash wallet, cross-merchant credit, immediate self-service Meta embedded signup, deep Google Calendar sync, revenue-share invoicing, custom domains. Design extension points but avoid implementing them now.

## Commercial interfaces without commercial assumptions
Maintain accurate event metrics for booking/visit/payment/return, but do not implement a commission invoice based on unverifiable merchant-reported payments. A variable fee business model may be revisited after real merchant interviews. Make plan and feature flags configurable, not pricing baked into business logic.
