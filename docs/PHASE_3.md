# Phase 3 delivery

Phase 3 adds the booking and payment engine, live slot selection, checkout, receipts, calendar downloads, customer booking history, in-app notifications and owner add-ons.

## Entry points

- `/turfs/[slug]` for pitch, date, contiguous slots, add-ons and quote.
- `/checkout/[bookingId]` for the hold countdown, contact details and payment.
- `/bookings/[bookingId]/confirmation` and `/bookings/[bookingId]` for provider-backed status and receipt actions.
- `/dashboard/bookings` and `/dashboard/notifications` for history and updates.
- Owner venue wizard, Facilities section, for equipment and service configuration.

The new modules live in `src/modules/{bookings,checkout,inventory,payments,addons,notifications,receipts,jobs}`. The quote calculator extends `src/modules/pricing`. Shared UI is under `src/components/bookings`.

## Verification and deployment limits

Run `bun run test` with a separate migrated `TEST_DATABASE_URL`. Run `bun run test:e2e` for the production-build browser suite. Playwright starts a loopback-only Razorpay mock and intercepts the Checkout script. The automated suite uses isolated PostgreSQL, mock payment captures, and local email files. It covers Phase 1 and Phase 2 regressions.

Live Razorpay test checkout, provider webhook delivery, Resend delivery and the deployed scheduler depend on deployment credentials and configuration. The app requires an INR amount of at least 100 paise for paid checkout. The current PDF uses a Latin-character font and substitutes unsupported glyphs. Formal WCAG 2.2 AA and representative hosted latency benchmarks remain pending.

## Local performance measurements

A production server on loopback returned availability at 190 ms p95 across 40 HTTP requests in groups of ten. The booking service returned a 519 ms p95 in a separate 100-request test against the same slot, with one successful hold and 99 safe conflicts. Booking timings exclude API authentication, HTTP transport, and payment requests. Measure both endpoints under representative hosted traffic before using these numbers as service commitments.

The local development database validated the slot ownership check. The reused isolated test database has four legacy Phase 2 fixtures with missing booking references. The migration preserved them, and the constraint applies to new writes.

## Phase 4 readiness

- [x] Authoritative pitch inventory, immutable charges, and booking status transitions.
- [x] Provider intent ledger, auditable confirmation, and late-payment compensation.
- [x] Customer history, receipts, notifications, and scheduled recovery jobs.
- [ ] Owner booking calendar and staff controls using the existing pitch locks.
- [ ] Manual and offline reservations and policy-driven cancellation.
- [ ] Customer refund requests, operational exception handling, and reporting.
