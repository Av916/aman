# Analytics

Analytics reads ledgers, booking aggregates and slot inventory for authorized venues and pitches. Day and month boundaries are calculated in each venue’s time zone and then converted to UTC. Chart input already contains aggregates.

| Metric                        | Definition                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Today’s bookings              | Sessions starting today that are confirmed, checked in, completed, or recorded as no-show.                                          |
| Upcoming bookings             | Confirmed or checked-in sessions with an end time in the future.                                                                    |
| Collected today or this month | Online captures plus recorded offline collections occurring in the venue business period.                                           |
| Gross booking value           | Face value of bookings with a confirmation timestamp in the session range. Replacement bookings supersede moved originals.          |
| Net collected                 | Captures less processed refunds by ledger occurrence time.                                                                          |
| Outstanding payments          | Full balances on unpaid confirmed manual reservations, including completed and no-show records.                                     |
| Pending payments              | Future or ongoing booking records still in pending-payment status.                                                                  |
| Pending refunds               | Refund obligations in pending or processing, with the corresponding amount in paise.                                                |
| Open slots today              | Future inventory in available status during the venue’s current business day.                                                       |
| Pitch occupancy               | Minutes of sellable inventory attributed to confirmed, checked-in, completed, or no-show bookings, divided by all sellable minutes. |
| Cancellation rate             | Confirmed bookings later cancelled, divided by booking records that reached confirmation and remain the canonical reservation.      |

Blocked inventory and closed days supply zero sellable minutes. Pending holds contribute to sellable minutes and no booked minutes. A pitch with no sellable minutes reports zero occupancy.

The daily timeline groups ledger events by collection or refund date. Weekly booking and exception series group sessions by start date. Hourly and weekday/weekend occupancy attributes sellable minutes to the slot’s local start hour. Repeat rate is the fraction of registered or repeat guest identities with more than one eligible booking within the selected range.
