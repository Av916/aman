# Phase 5 launch report

PitchMate remains a Next.js modular monolith with PostgreSQL as the system of record. Phase 5 adds separate deployment validation, health endpoints, bounded job runs, read-only integrity checks, administrator recovery, telemetry, release pipelines and a standalone image.

```text
.github/workflows/          Isolated CI and protected release
Dockerfile, vercel.json     Standalone image and hosted scheduler
src/modules/system/         Job leases, health, recovery and integrity
src/app/api/internal/       Scheduler and protected metrics endpoints
scripts/                    Smoke, load, restore and audit commands
tests/                      Unit, database, browser and accessibility checks
docs/                       Launch and operating runbooks
```

- [Architecture](ARCHITECTURE.md) · [Database](DATABASE.md) · [API](API.md)
- [Audit findings](PRODUCTION_READINESS.md) · [Security](SECURITY.md) · [Deployment](DEPLOYMENT.md) · [CI and release](CI_CD.md)
- [Monitoring](MONITORING.md) · [Performance](PERFORMANCE.md) · [Load tests](LOAD_TESTING.md)
- [Backup and recovery](BACKUP_RECOVERY.md) · [Payment operations](PAYMENT_OPERATIONS.md) · [Incidents](INCIDENT_RESPONSE.md) · [Environment setup](ENVIRONMENT_SETUP.md)

## Open launch gates

- [ ] Provision independent staging and production projects, databases and provider credentials.
- [ ] Verify Google OAuth, Razorpay test-mode capture, signed webhooks, refunds, media and Resend delivery.
- [ ] Verify CSP and external telemetry and alerts in staging.
- [ ] Exercise hosted point-in-time restore and object storage recovery.
- [ ] Measure representative authenticated traffic, target-device Web Vitals and full accessibility.
- [ ] Approve marketplace settlement, legal policies, retention, and customer support.
- [ ] Obtain explicit rollout approval, pass staging verification, and verify production smoke checks.

Public policy copy reflects the application workflows. Qualified business and legal review is a launch gate. [MeitY data protection rules](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa)

## Infrastructure cost illustration

Vercel Pro starts at US$20 per month. At 100 Neon Launch CU-hours per month, compute at US$0.106 per CU-hour adds US$10.60 before storage, restore history, transfer and any minimum. The illustrative subtotal is US$30.60. Email, media, monitoring, domain fees, tax and transactions are additional. Minute scheduler traffic can keep the database active and increase usage. [Vercel pricing](https://vercel.com/pricing) · [Neon compute pricing](https://neon.com/blog/major-compute-price-reduction-on-neon)

## Verification scope

| Check                     | Local result                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migrations and PostgreSQL | All 12 migrations applied to the isolated database. Both source and restored schemas matched Prisma.                                                                                                                                             |
| Unit and integration      | 28 unit and 31 PostgreSQL integration tests passed. Coverage measured 71.7% of lines and 61.35% of branches.                                                                                                                                     |
| Browser and CSP           | The 13-test production suite passed with report-only CSP and with nonce enforcement. Selected WCAG AA checks and skip-link navigation passed on the public routes tested.                                                                        |
| Inventory and finance     | 100 HTTP hold requests across two processes produced one hold and 99 expected conflicts. Mocked payment, reconciliation, refund and ledger tests passed.                                                                                         |
| Readiness and monitoring  | Readiness returned 503 without PostgreSQL while liveness returned 200, then recovered. Cron and protected metrics responded after recovery. An isolated collector received traces and metrics and did not receive a synthetic secret in a query. |
| Backup                    | Logical restore took 514 ms on a small local fixture. Record counts matched and all 12 integrity checks returned zero findings.                                                                                                                  |
| Safety checks             | TypeScript, ESLint, formatting, the Bun advisory audit, scoped Semgrep rules, Gitleaks on committed history and Actionlint passed locally.                                                                                                       |
| Container and release     | Next.js standalone built and passed local smoke checks. Compose configuration validated. Docker image build and Trivy scanning require an accessible daemon. The GitHub and Vercel workflows remain unexecuted.                                  |

The browser harness used a loopback Razorpay mock. External provider credentials, merchant and settlement approval, an approved legal and retention policy, a monitored staging deployment, a hosted restore rehearsal and explicit approval remain required for production. [Local load results](LOAD_TESTING.md) · [Recovery evidence](BACKUP_RECOVERY.md)

The local load run covered baseline, normal, stress, spike and five-minute soak profiles. The normal-load availability p95 was 501 ms and the soak availability p95 was 514 ms against a 500 ms target. The existing PostgreSQL adapter emitted a pg 9 forward-compatibility warning under pg 8 during concurrent runs. Track it before the next driver upgrade.
