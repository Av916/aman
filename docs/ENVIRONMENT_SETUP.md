# Environment setup

Copy the variables in the repository example for development. Use a separate TEST_DATABASE_URL for tests. The browser harness supplies loopback mock payment and email settings.

| Setting                               | Purpose                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| APP_ENV, APP_URL                      | Independent staging or production modes and canonical HTTPS origin. Vercel preview uses staging. |
| DATABASE_URL, DIRECT_DATABASE_URL     | Secret TLS PostgreSQL URLs for pooled runtime and direct migration access.                       |
| DB_POOL_MAX                           | Per-process pool capacity. Budget it across concurrent instances.                                |
| AUTH_SECRET and Google OAuth settings | Unique secrets per environment. Callback path is /api/auth/callback/google.                      |
| Razorpay credentials                  | Separate keys and webhook secret. Staging requires test keys.                                    |
| ENABLE_LIVE_PAYMENTS                  | Explicitly opts in to configured live Razorpay keys.                                             |
| Cloudinary and email settings         | Persistent media and verified email sender with secret credentials.                              |
| CRON_SECRET, INTERNAL_JOB_SECRET      | Independent bearer credentials for cron and internal requests.                                   |
| AUTH_TRUSTED_IP_HEADER                | Optional trusted ingress header for containers. The ingress must replace client-supplied values. |
| CSP_MODE, LOG_LEVEL                   | Report-only and info by default.                                                                 |
| SUPPORT_EMAIL                         | Public verified customer support mailbox.                                                        |
| OTLP endpoints and headers            | Optional server-side collector configuration and credentials.                                    |

Use separate projects, database credentials, and provider secrets. Verify the actual project and database targets during provisioning.
