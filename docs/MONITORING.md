# Monitoring

Configure an OTLP collector and structured log drain. API responses include a request ID. Logs include status, method, duration, and machine codes. Browser beacons report generic errors and vitals without account or booking identifiers. Trace processing strips events and uses a span-attribute allowlist.

- Probe /api/health/live and /api/health/ready separately.
- Scrape /api/internal/metrics with the internal bearer secret. Use its booking, payment, refund and outbox gauges.
- Track server error rate and endpoint duration, hold creates and conflicts, verification failures, job execution time, browser exceptions and vitals.
- Alert on repeated readiness failure, sustained 5xx over 1%, database connection exhaustion, failed refunds, growing outbox backlog, stale jobs, and financial inconsistencies.
- Use /admin/system for bounded diagnostic and recovery views. Escalate nonzero integrity findings to finance and platform operators.

Verify the deployed metrics and alert routing in staging. Configure destinations with the platform owner. [Vercel instrumentation](https://vercel.com/docs/tracing/instrumentation)
