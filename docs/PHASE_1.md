# Phase 1 delivery

The pasted PitchMate brief governs this implementation. The attached TurfSlot SRS provides background for the India-first cricket marketplace and later inventory, payment and owner operations. Phase 1 implements identity, onboarding, account maintenance, authorization, health and the application shell.

## Acceptance coverage

| Area         | Phase 1 result                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public pages | Responsive landing page, demo search, sample listings, product walkthrough, owner onboarding and FAQ                                                             |
| Accounts     | Customer and owner registration, email verification and resend, credentials and Google sign-in configuration, logout, password reset and change, profile editing |
| Roles        | Server-enforced customer, owner and admin dashboard access, owner approval status, admin provisioning and read-only user, owner and audit views                  |
| Persistence  | Prisma 7 with a pg pool, initial PostgreSQL migration, transactional account and token mutations, persistent rate limits and audit records                       |
| Interfaces   | Custom JSON API, Zod form and API validation, reusable UI primitives, light and dark themes                                                                      |
| Verification | Vitest unit and PostgreSQL integration suites, Playwright smoke and authentication flows, strict TypeScript, ESLint and a production build                       |

## Known limits

Google's live authorization round-trip and Resend delivery require external credentials. The local email adapter and Google identity persistence can be tested independently. Owner verification appears in the dashboard. Approval and moderation use controlled operational access in this phase.

The LCP target is at most 2.5 seconds under representative conditions. A local production Chromium check recorded a median landing-page LCP of 0.86 seconds across three runs at a 390 px viewport, with 150 ms network latency, 1.6 Mbps download, and 4× CPU throttling. Field LCP and formal WCAG 2.2 AA conformance require deployment measurements and audits.

## Phase 2 readiness checklist

- [x] User identity, owner verification status, role and ownership helpers, and audit records.
- [x] PostgreSQL migration history, connection pooling, modular boundaries and test harness.
- [x] Public discovery layout and separate owner and admin navigation.
- [ ] Model venues, bookable pitches, hours and blackouts. Add owner and staff ownership tests.
- [ ] Build live discovery and venue detail pages, approved venue publishing and availability checks.
- [ ] Add atomic slot allocation, concurrency tests, quote snapshots and hold expiry.
- [ ] Add owner scheduling, pricing and reservations on the same inventory model.
- [ ] Integrate payment orders, signed webhooks, idempotent reconciliation and retryable email delivery when payment scope begins.
- [ ] Validate representative performance, accessibility and recovery before commercial launch.
