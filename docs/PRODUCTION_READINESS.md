# Production readiness audit

The audit covers the Phase 1–4 modular monolith, PostgreSQL constraints, route guards, payment inbox and outbox, public caching, and browser journeys. Production deployment requires separate authorization.

| Severity | Initial finding                                                               | Release gate                                                                                         |
| -------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| P0       | Commercial marketplace settlement and merchant activation are unverified      | Obtain provider and business approval and exercise capture, settlement and refund in staging         |
| P0       | No verified hosted restore, environment isolation or launch approval          | Configure independent staging and production, rehearse hosted restore, approve production explicitly |
| P1       | Jobs lacked durable run history and a deployment scheduler                    | Add bounded scheduled entry points, leases, diagnostics and recovery                                 |
| P1       | No read-only integrity gate or operational exception view                     | Add invariant checks and admin-only tools                                                            |
| P1       | Dependency, application, and deployment checks were manual                    | Run CI on isolated PostgreSQL and keep deployment secrets in protected environments                  |
| P1       | Trust boundaries for hosted credentials and proxy headers were implicit       | Enforce explicit environment and trusted ingress configuration                                       |
| P1       | No observed hosted error, latency or backlog alerts                           | Add instrumentation and health endpoints, then configure and test external alerts                    |
| P2       | Global limiter writes can concentrate lock traffic                            | Batch PostgreSQL writes and benchmark against isolated fixtures                                      |
| P2       | Public indexing, CSP compatibility and accessibility evidence were incomplete | Add SEO boundaries, staged CSP and browser checks                                                    |
| P3       | Optional offline shell and bundle tuning                                      | Keep the private booking and payment application network-only                                        |

## Current disposition

Repository-side P1 work is implemented for scheduler leases, health and recovery, integrity audits, CI configuration, and environment checks. External telemetry and alert delivery still need staging configuration. Commercial merchant and settlement approval, legal review, live provider checks, and managed recovery remain open launch gates. The verification report records local scope and performance exceptions. [Launch report](PHASE_5.md)
