# PitchMate

**Your Game. Your Pitch.**

PitchMate is a cricket turf marketplace for players and facility owners. The app includes account management, role-specific dashboards, live turf discovery, owner venue tools and date-based availability. Optional local demo data illustrates the full marketplace workflow.

## Local setup

Install Bun 1.4+, a supported Node.js version (20.19+, 22.12+ or 24+), Docker with Compose, and OpenSSL. The lockfile is managed by Bun.

```bash
bun install --frozen-lockfile
cp .env.example .env
openssl rand -base64 48
```

Put the generated value in `AUTH_SECRET` in `.env`. Keep the local database credentials in `DATABASE_URL` aligned with the `POSTGRES_*` values. Use `http://localhost:3000` consistently in your browser and as `APP_URL`.

```bash
docker compose up -d --wait
bun run db:generate
bun run db:migrate
bun run dev
```

Open `http://localhost:3000`. With the default email configuration, registration and reset links are saved in the ignored `.pitchmate-mail/` directory. Open the complete link, including its fragment, using the same application origin.

To create a local admin, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env`. Use a unique password with at least 16 characters and run `bun run db:seed`. Sign in at `/login`. Other accounts are created through `/register` or `/register-owner`.

## Configuration

| Variable                                                             | Purpose                                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                       | PostgreSQL connection. Use a pooled endpoint for application traffic where applicable.                                    |
| `DIRECT_DATABASE_URL`                                                | Optional direct connection for Prisma CLI migration commands.                                                             |
| `AUTH_SECRET`                                                        | Unique secret, minimum 32 characters. Share it across application instances.                                              |
| `APP_URL`                                                            | Canonical origin with no trailing slash. Deployed instances require HTTPS. This also configures NextAuth's canonical URL. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`                               | Set both to enable Google sign-in. Register `APP_URL/api/auth/callback/google` as the redirect URI.                       |
| `EMAIL_FROM`, `EMAIL_PROVIDER_API_KEY`                               | Verified Resend sender and API key. Both are required for deployed instances.                                             |
| `AUTH_TRUSTED_IP_HEADER`                                             | Optional lowercase header name from an ingress that overwrites this header with a single verified client IP.              |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Local Docker Compose database configuration.                                                                              |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`                            | Development admin provisioning.                                                                                           |
| `PROVISION_ADMIN_EMAIL`, `PROVISION_ADMIN_PASSWORD`                  | One-time operator credentials for production provisioning. Inject both through your secret manager.                       |
| `TEST_DATABASE_URL`                                                  | Separate disposable database for integration and browser tests.                                                           |

For a deployment, run `bun run db:deploy` to apply committed migrations, then use `bun run build` and `bun run start`. Run `NODE_ENV=production bun run db:provision-admin --confirm` from a trusted operator environment to create a production admin. Remove the provisioning values after use. The command refuses to promote an existing account.

## Checks

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

For integration and browser tests, create a separate PostgreSQL database, set `TEST_DATABASE_URL` in `.env`, and apply the migration there.

```bash
bun --env-file=.env -e 'const p = Bun.spawn(["bun", "run", "db:deploy"], { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, DIRECT_DATABASE_URL: "" }, stdout: "inherit", stderr: "inherit" }); process.exit(await p.exited)'
bun run test
bunx playwright install chromium
bun run test:e2e
```

Vitest skips database integration tests when `TEST_DATABASE_URL` is absent. Playwright requires that database, creates a production build, and starts its own server on port 3100. The test runner uses local email files and disables external providers.

Use `bun run format` for Prettier, `bun run db:studio` to inspect local data, and `bun run db:deploy` to apply checked-in migrations without the development migration workflow.

## Reference

- [Architecture and folder structure](docs/ARCHITECTURE.md)
- [Database and ER diagram](docs/DATABASE.md)
- [API and request examples](docs/API.md)
- [Security and operational controls](docs/SECURITY.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Phase 1 scope and Phase 2 checklist](docs/PHASE_1.md)

## Phase 2 marketplace

Apply the marketplace migration with `bun run db:migrate` locally or `bun run db:deploy` for a configured deployment. Check that the PostgreSQL migration role can install `btree_gist`. Existing users and accounts are preserved.

For fictional demonstration data on a loopback database, set `DEMO_ACCOUNT_PASSWORD` to at least 16 characters and run `bun run db:seed:demo`. The seed adds 12 venues across Ludhiana, Chandigarh, Delhi and Bengaluru, owner accounts with addresses such as `owner-ludhiana@demo.pitchmate.test`, and `player@demo.pitchmate.test`. The admin seed still uses `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. To verify an existing active owner from the operator environment, use `bun run db:verify-owner owner@example.com`.

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` together to enable hosted image uploads. On loopback, files are stored privately under `.pitchmate-media/` unless `PITCHMATE_MEDIA_DIR` is set. Uploads default to 10 images per venue and 5 MB per image. The defaults for timezone, currency, and inventory horizon are `Asia/Kolkata`, `INR`, and 30 days. Schedule `bun run slots:extend`, or set `SLOT_JOB_SECRET` to call the batch HTTP job.

- [Phase 2 scope and Phase 3 readiness](docs/PHASE_2.md)
- [Venue workflow](docs/VENUE_MANAGEMENT.md)
- [Availability generation](docs/SLOT_GENERATION.md)
- [Pricing rules](docs/PRICING_RULES.md)
