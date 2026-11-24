# Booking background jobs

Run `bun run bookings:work` approximately once per minute from a platform scheduler with the application environment. Alternatively call the internal HTTP endpoints using `Authorization: Bearer <INTERNAL_JOB_SECRET>`.

| Endpoint                                     | Batch                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `POST /api/internal/jobs/expire-bookings`    | Expire due holds, release their own slots, and complete ended checked-in bookings.                                     |
| `POST /api/internal/jobs/reconcile-payments` | Repair ambiguous orders by receipt, observe missing payment events, retry persisted webhooks and poll pending refunds. |
| `POST /api/internal/jobs/process-outbox`     | Generate receipts, deliver emails, and request automatic compensation.                                                 |

Phase 4 adds a reminder step to the CLI worker. External HTTP schedulers should also call `POST /api/internal/jobs/remind-bookings`. Configure lead times with `BOOKING_REMINDER_MINUTES`. Each reminder uses a stable booking and interval key. Registered customers receive an in-app notification and email. Guests can receive email when the booking contains an address.

The expiry worker is idempotent and checkout independently enforces the deadline. Reconciliation polls recent order intents for seven days. Webhooks remain accepted after that interval. Outbox dispatch uses PostgreSQL row claims with `SKIP LOCKED`, leases, attempt-based fencing and bounded backoff.

Refunds use the same provider idempotency key on every retry. Persisted provider refund IDs are polled until terminal. Provider-declared terminal failures and exhausted work remain visible for review. Receipt records use a unique booking key. Local email delivery uses deterministic file names. Resend calls use its idempotency header. Monitor failed work and deploy the scheduler before accepting real payments.

[Resend email idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
