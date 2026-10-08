# Case-study protocol

## Goal
Produce defensible proof without claiming causation the data cannot support.

## Metrics captured automatically
- booking count
- booking source/UTM
- booked service and price
- booked revenue
- completed appointments
- cancellations
- no-shows
- booking lead time
- repeat customers by normalized phone hash/identifier
- reminder delivery state

## Baseline
Before launch, ask the merchant for the previous 30 days:
- total appointments
- no-shows
- cancellations
- approximate average ticket
- main booking channel

If they cannot provide credible baseline data, do not invent uplift. Publish only system-native metrics such as:
- “147 appointments booked through SalonOS in 30 days”
- “91% of system bookings were marked completed”
- “12 no-shows out of 147 bookings”

## Claims standard
Allowed:
- observed system metrics
- merchant testimonial clearly labeled as testimonial
- before/after comparisons where the same merchant supplied a documented baseline

Not allowed:
- calling every system booking an “acquired customer”
- claiming revenue caused by the software merely because the booking passed through it
- estimating client count from follower count

## Video case study structure
1. 5 seconds: merchant/problem
2. 10 seconds: booking flow
3. 10 seconds: reminders/dashboard
4. 10 seconds: real 30-day metrics
5. 5 seconds: merchant quote
6. CTA: “We install this for appointment businesses in Rabat/Temara.”
