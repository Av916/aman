# Remediation plan

## P0 · Confirmed critical defects

None confirmed. Keep live marketplace payment activation behind approved provider, merchant, legal and operational launch gates. A hosted release should require successful payment, refund and database recovery rehearsal. [Payment operations](../PAYMENT_OPERATIONS.md#L7) · [Readiness gates](PRODUCTION_READINESS.md)

## P1 · Major functionality and launch prerequisites

| Order | Work                                                                                                                                                            | Acceptance evidence                                                                                                                                     |
| ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | Separate ambiguous refund lookup from confirmed terminal-failure recovery. Route refund-first captures and unmatched refund events into durable reconciliation. | Fault-ordering and replay tests, bounded refund totals, auditable terminal disposition and idempotent ledger effects. [F02 and F04](BROKEN_FEATURES.md) |
|     2 | Correct Upcoming and past booking queries and pagination. Verify no-show and attendance transitions for past unmarked bookings.                                 | Browser cases for future, ended and cancelled bookings, plus an explicit no-show case. [F01](BROKEN_FEATURES.md#f01-past-reservations-in-upcoming)      |
|     3 | Size and monitor reconciliation by oldest queued item and throughput. Provide a catch-up path for old pending orders.                                           | Backlog, outage and restart simulations with documented work limits and alert thresholds. [F05](BROKEN_FEATURES.md#f05-reconciliation-backlog-capacity) |
|     4 | Build provider settlement ingestion and authorized owner payout reconciliation after establishing the merchant arrangement.                                     | Compare provider/bank settlements, refunds and ledger entries across duplicate feeds and adjustments. [Missing feature](MISSING_FEATURES.md)            |
|     5 | Activate staged OAuth, payment, email, media, cron and telemetry. Run production-grade backup and rollback rehearsals with appropriately scoped accounts.       | Staged smoke and test-mode payment evidence, restore timings, external alerts and signed approvals. [Hosted gates](PRODUCTION_READINESS.md)             |

## P2 · Scope and verification gaps

1. Verify SRS availability p95 on a representative dataset and instrument authenticated operations and job backlogs. [F07](BROKEN_FEATURES.md#f07-availability-latency-target-missed-in-the-recorded-run)
2. Finish QR-based arrival if the SRS requirement is retained and cover expiry and replay in the scanner flow. Expand browser tests for approved reschedule, review response and moderation, customer directory, owner approvals and reports. [QR gap](MISSING_FEATURES.md#f06--qr-based-attendance) · [Feature matrix](FEATURE_MATRIX.md)
3. Validate occupancy and booking analytics with varied schedules, block overlaps and timezone boundaries. Verify mobile and theme rendering across checkout, calendar and operations. [Analytics](../../src/modules/finance/analytics.ts#L21) · [Accessibility baseline](../../tests/e2e/phase-five.spec.ts#L39)
4. Add the staff ownership read invariant and rerun isolation tests. Check the PostgreSQL client warning before upgrading the driver. [Security](SECURITY_AUDIT.md) · [Test results](TEST_RESULTS.md)

## P3 · Optional follow-up

Add broader visual regression for theme and responsive polish after the required mobile and accessibility verification. [Existing mobile test](../../tests/e2e/phase-one.spec.ts#L55)
