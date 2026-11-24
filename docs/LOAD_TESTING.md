# Load testing

Use an isolated loopback environment and production build. The test:load command supports baseline, normal, stress, spike and soak with 50, 100, up to 500, 300, and 30 virtual users respectively. Set LOAD_VENUE_SLUG and LOAD_PITCH_ID for published detail and availability. Set test account cookies and venue/slot IDs to include calendar, analytics, history or quotes. The integration suite separately tests 100 competing booking requests with isolated customers and a mock payment provider.

Use the hosted staging data distribution for representative concurrency, authenticated endpoint and database capacity testing. Load-test production only with explicit authorization.

## Local results

Two standalone application processes shared an isolated PostgreSQL database. One 100-request booking race returned one hold and 99 conflicts with a 622 ms p95. The competing processes did not use a shared memory lock.

| Profile             | Landing p95 | Discovery p95 | Venue p95 | Availability p95 |
| ------------------- | ----------: | ------------: | --------: | ---------------: |
| Baseline, 50 users  |    1,054 ms |        867 ms |  1,052 ms |           872 ms |
| Normal, 100 users   |      482 ms |        421 ms |    637 ms |           501 ms |
| Stress, ramp to 500 |    1,615 ms |      1,758 ms |  4,149 ms |         2,617 ms |
| Spike, 300 users    |    1,344 ms |      1,088 ms |  2,587 ms |         1,572 ms |

The normal profile returned zero unexpected errors over 1,659 requests. Discovery met the 500 ms target. Availability exceeded it by 1 ms in that run. These are small-fixture loopback samples with synchronized virtual-user starts. Stress latency rose substantially even with no unexpected HTTP errors in the short run. Confirm the production targets with representative staging traffic.

Separate authenticated samples used 20 requests per endpoint in groups of four on the small fixture. Booking history was 93 ms p95 and quotes were 50 ms p95. The final browser run measured 37 ms for the calendar and 43 ms for analytics under its 20-request samples. These exercised authenticated request paths with far less parallelism than the public normal-load profile.

The 30-user, five-minute soak completed 7,359 requests with zero unexpected HTTP errors and zero rate-limited responses. p95 was 675 ms for landing, 447 ms for discovery, 669 ms for venue detail, and 514 ms for availability. The loaded process RSS rose from about 769 MiB to 834 MiB between the inspected mid-run and end samples. This short process sample cannot distinguish warm caching from sustained growth. Longer memory, connection, and backlog checks belong in staging.
