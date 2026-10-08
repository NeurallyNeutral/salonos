# 10-minute full-stack test drive

## 1. Customer
Open **Customer booking**.
- Choose Piercing lobe.
- Choose a date/time.
- Confirm the appointment.
- On the success screen, open the secure management link.
- Reschedule it or cancel it.

Watch the event stream later: the booking, confirmation, and management actions are recorded.

## 2. Merchant
Open **Dashboard** and **Calendar**.
- Open an appointment.
- Mark it completed or no-show.
- Completed appointments can queue a review request.

Open **Services & hours**.
- Disable a service.
- Add a blackout.
- Change a price.

Open **Automations**.
- Toggle rules.
- Run the reminder cron.

Open **Settings**.
- Pause bookings, then go back to Customer booking and see the storefront refuse new appointments.
- Toggle WhatsApp to see the fallback strategy.

## 3. Communications
Open **WhatsApp / Email**.
- Inspect queued/delivered messages.
- Process the queue.

Open **Observability**.
- Inject a provider failure.
- Return to messaging and see the failed send.

## 4. New merchant onboarding
Open **Merchant onboarding**.
- Walk through the 5-step setup.
- Connect WhatsApp in the simulation.
- Launch the tenant.
- The new business appears in Platform Admin.

## 5. SalonOS operator
Open **Platform admin**, **Billing / MRR**, and **Observability**.
- See all tenants from one control plane.
- Review MRR and invoice state.
- Inspect system failures and events.

## 6. Proof / sales
Open **Analytics** and **Customer manage + case study**.
- Note the separation between “bookings processed” and “customers acquired.”
- These are the screens that generate case-study proof without manual spreadsheet work.

## 7. Architecture
Open **Architecture / events** to see the target production path:
Customer/Merchant UI → Hono Worker API → D1 → cron/queue → Meta/Resend → webhook/event log.
