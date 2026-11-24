# Phase 4 operations

## Implementation plan

1. Extend the existing booking, payment, and slot records additively. Preserve historical snapshots and establish database checks for registered or guest identity and financial amounts.
2. Authorize operational requests by authenticated user, verified owner or active staff assignment, and specific permission. Recheck write permissions in inventory transactions.
3. Build the date-range calendar and paginated reservation list. Create manual reservations using the same quote and all-or-nothing slot claim as online holds. Record offline settlement separately from provider captures.
4. Snapshot versioned cancellation policies and serialize cancellation, slot release and refund allocation. Route provider refunds through the existing outbox and track confirmed offline settlements separately.
5. Add check-in windows and single-use tokens, then implement replacement booking workflows with an atomic inventory handoff and explicit payment allocation.
6. Record append-only financial events, backfill existing captures and processed refunds, and aggregate business-day reporting within each authorized venue. Protect exports and audit sensitive actions.
7. Add customer directory, staff invitations, verified reviews, coupon limits and scheduled reminders. Connect owner, staff, customer and admin interfaces across their normal routes.
8. Exercise contention and authorization in isolated PostgreSQL. Verify the migrated schema, browser journeys and production build.

## Delivered workspace

- Owners and staff use `/owner/calendar`, `/owner/bookings`, and `/owner/check-in` for slot availability, manual reservations, collections, attendance, maintenance, and rescheduling.
- Owners and delegates with the applicable permissions use `/owner/dashboard`, `/owner/analytics`, `/owner/payments`, `/owner/refunds`, `/owner/reports`, `/owner/customers`, `/owner/staff`, `/owner/policies`, `/owner/reviews`, and `/owner/coupons`.
- Customers manage eligible bookings at `/bookings/[bookingId]`. They can review cancellation terms before payment, get a cancellation quote, track refunds, reschedule, present a short-lived check-in token, and review a completed booking. Published ratings appear on the venue page.
- Administrators have a platform overview and management pages for users, owners, venues, bookings, payments, refunds, reviews, coupons, reports, audit logs, and fee settings.

```text
src/app/{owner,admin,staff}/     Operational pages
src/app/api/                     Authenticated endpoint wiring
src/components/operations/       Calendar, tables, charts and action dialogs
src/modules/operations/         Reservation, attendance, maintenance and scoped reads
src/modules/{staff,permissions}/ Venue membership and access rules
src/modules/{cancellations,rescheduling,finance}/ Policies and payment operations
src/modules/{coupons,reviews}/    Promotion and verified review services
src/modules/jobs/                Durable reminders, reconciliation and outbox
prisma/{schema.prisma,migrations/} Operational models and additive migrations
```

The Recharts components load on the client and consume server-aggregated series. The custom calendar grid uses the existing slot generator and a list alternative. [Calendar flow](CALENDAR_SYSTEM.md) · [Recharts responsive sizing](https://recharts.github.io/en-US/guide/sizes/)

## Supporting references

- [Schema and ER diagram](DATABASE.md) · [Endpoint reference](API.md) · [Security controls](SECURITY.md)
- [Manual reservations](MANUAL_BOOKINGS.md) · [Booking states](BOOKING_STATE_MACHINE.md) · [Staff permissions](STAFF_PERMISSIONS.md)
- [Cancellation policies](CANCELLATION_POLICY.md) · [Refund engine](REFUND_ENGINE.md) · [Rescheduling](RESCHEDULING.md)
- [Ledger semantics](FINANCIAL_LEDGER.md) · [Analytics definitions](ANALYTICS.md) · [Reporting](REPORTING.md)

## Installation and testing

Apply the operational migrations with `bun run db:deploy`. Continue using the Razorpay and email environment variables already configured for Phase 3. `CHECK_IN_EARLY_MINUTES` defaults to 30. `BOOKING_REMINDER_MINUTES` defaults to `1440,120`. Run the existing `bun run bookings:work` job on its configured schedule. If using the authenticated HTTP job endpoints, include `POST /api/internal/jobs/remind-bookings`.

Point `TEST_DATABASE_URL` at a separate migrated PostgreSQL database. Run `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run test:e2e`. Playwright starts a production build and a loopback payment mock. The integration suite exercises inventory contention, customer and staff permission checks, full and partial refunds, duplicate confirmation and ledger events, coupon claims, attendance and reminders.

## Operating limits and Phase 5 checks

- The verified check-in flow accepts short-lived tokens and booking reference lookup. Camera-based scanning is outside the current UI.
- Same-pitch moves are supported. A moved reservation has one completed replacement in its chain. Offline balances are collected in full, and exports above 5,000 rows require a narrower filter.
- A paid coupon order must meet the ₹1 checkout minimum. Redeemed usage remains counted after cancellation.
- Processed offline payments reflect the operator’s report. Outstanding balances, gross booking value and net captured funds have separate definitions. Provider bank settlement requires external settlement data.
- Stage with real Razorpay test credentials and Resend configuration. Verify signed refund deliveries, scheduled reminders, provider failure recovery and the deployed job token.
- Measure API latency against representative venue and booking volume. Review accessibility with a formal WCAG audit.
- Configure production monitoring, backups, restore tests, CI/CD and operational alert routing during Phase 5.

## Local verification results

The six Phase 4 migrations applied to the local development and test databases. All ten project migrations replayed on a fresh PostgreSQL database, and Prisma reported no drift. A separately generated destructive draft was archived during implementation. Its schema changes were reversed on the local instances, and its superseded migration-history records were backed up and removed there. No hosted database was changed.

TypeScript, ESLint, changed-file formatting, and the production build passed. Vitest passed 23 unit and 28 integration tests, and the Playwright production suite passed 10 tests across Phases 1–4. The suite verified one booking winner for shared inventory, bounded refund reservations, a single final coupon redemption, atomic rescheduling and one ledger event for duplicate refund observations.

| Authenticated endpoint | Local p95 |
| ---------------------- | --------: |
| Calendar               |    123 ms |
| Reservations           |     76 ms |
| Analytics              |     72 ms |

Each endpoint had 20 warmed loopback requests in groups of four against a small fixture. These readings characterize the local test, with representative hosted traffic still pending.
