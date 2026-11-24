# CI and release

CI provisions isolated PostgreSQL 17, installs the frozen lockfile, applies migrations, and runs formatting, lint, TypeScript, unit, database, dependency audit, and Playwright. The browser suite builds and starts Next.js with a loopback payment provider. The security job scans history for secrets, scans unsafe code patterns, and builds and scans the non-root container.

The dispatch-only release workflow requires successful CI on the exact main commit, applies staging migrations, deploys the separate staging project, and checks readiness and access control. Production is an explicit option after successful staging and a protected GitHub production environment. Configure required reviewers and restrict both environments to main. Keep production secrets outside pull requests.

GitHub environment secrets are DATABASE_URL, DIRECT_DATABASE_URL and VERCEL_TOKEN. Environment variables are VERCEL_ORG_ID, VERCEL_PROJECT_ID and APP_URL. Protected staging can use a VERCEL_AUTOMATION_BYPASS_SECRET. The runtime application secrets belong in each separate Vercel project.
