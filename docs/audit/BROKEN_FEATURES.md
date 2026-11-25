# Broken features and failure modes

## F01 Past reservations in Upcoming

**P1 · BROKEN.** A synthetic customer reservation with a past interval and `CONFIRMED` status appeared in the same query used by the Upcoming tab. The view labels the status as Upcoming and the repository only filters by status. The attendance worker completes checked-in bookings once their end time passes. An unattended, unmarked reservation can remain Confirmed. This is a booking history defect. The tested slot acquisition invariant still held under contention. [History page](../../src/app/%28customer%29/dashboard/bookings/page.tsx#L15) · [History query](../../src/modules/bookings/booking.repository.ts#L133) · [Attendance job](../../src/modules/jobs/service.ts#L33)

## F02 Terminal refund retry returns to failed

**P1 · Failed subworkflow of refund reconciliation.** A refund stub returned terminal `failed`. The admin retry moved it back to Processing, and the next worker pass retrieved the same refund ID and returned to Failed. Across the initial attempt and retry the stub counted one create and one lookup. A pending refund without a provider ID follows a separate path. Keep ambiguous provider outcomes on reconciliation and add an auditable recovery action for explicitly terminal failures. No online payment or refund was initiated. [Admin retry](../../src/modules/finance/operations.ts#L145) · [Refund worker](../../src/modules/payments/refund.service.ts#L64)

## F04 Refund-first payment evidence can bypass financial exception queues

**P1 · Source trace.** A provider status of `refunded` can be selected by webhook recovery, then persisted with `paidAt` empty when the capture was never observed locally. Ledger posting runs after the capture guard. An unmatched provider refund can finish handling without a local refund row, and the unapplied-payment view only lists rows with a recorded paid time. The audit did not run this sequence against Razorpay. Add a durable exception for provider-refunded payments and unmatched refund webhooks. [Payment state transition](../../src/modules/payments/payment.service.ts#L192) · [Webhook recovery](../../src/modules/payments/webhook.service.ts#L136) · [Reconciliation queue](../../src/modules/system/status.ts#L65)

## F05 Reconciliation backlog capacity

**P1 · Source trace.** The scheduled invocation processes one candidate per category and polls a seven-day payment-order window. A sustained arrival above the processing rate or an outage long enough to leave old pending orders can leave provider events unreconciled. The load check did not model a provider backlog. Supply backlog age metrics and tested batch and recovery limits. [Scheduled handler](../../src/modules/system/jobs.ts#L58) · [Reconciliation selection](../../src/modules/jobs/service.ts#L88) · [Cron schedule](../../vercel.json#L2)

## F07 Availability latency target missed in the recorded run

**P2 · BROKEN performance criterion.** The repository’s Phase 5 benchmark recorded 501 ms normal-load and 514 ms soak p95 for availability against a 500 ms goal. This audit’s new 100-user run covered landing and discovery only. Establish a fresh SRS-sized inventory dataset and rerun the route-specific benchmark in staging. [Historical results](../LOAD_TESTING.md#L14) · [Targets](../PHASE_5.md#L51)

## F08 Rescheduling boundaries

**P2 · Partial workflow.** Same-pitch rescheduling, additional payment and lower-cost refunds have integration evidence. The service rejects rescheduling an already moved booking, constrains both intervals to the same pitch, and applies a minimum provider amount to additional charges. Confirm these documented limits for the MVP and explicitly cover the full approved browser flow. [Service](../../src/modules/rescheduling/service.ts#L51) · [Limitations](../RESCHEDULING.md)
