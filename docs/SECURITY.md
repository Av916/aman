# Security

## Authentication and access

- NextAuth v4 is the stable Auth.js release used here. Credentials use salted Argon2id with 19 MiB memory, two iterations and parallelism one. A dummy hash equalizes password verification work for missing credential accounts.
- Credentials users verify their email before signing in. Verification requires the original account password so an email recipient cannot accidentally activate a password set by another person. Password recovery remains available to accounts awaiting verification.
- Google sign-in uses PKCE, OAuth state and a verified provider email. New Google identities receive customer accounts. A provider identity and its account record are created in one transaction. Linking by a matching email is disabled, including for existing admins and owners.
- Auth.js manages HttpOnly, SameSite=Lax cookies and signs and encrypts JWT sessions. HTTPS origins use Secure cookies. The local loopback workflow supports HTTP. The session lifetime is eight hours, with rolling renewal through Auth.js.
- Every protected request resolves the current account and status plus the session version from PostgreSQL. Changing or resetting a password increments the version and revokes prior JWTs. Logout clears the current browser cookie.
- Role and owner-approval guards run on the server. Profile endpoints use the signed-in user's ID. Future venue and booking mutations must also check resource ownership. The non-public administrator provisioning command records an audit event. Owner approval is a controlled operational action in Phase 1.

## Request and token integrity

- Auth.js handles its own CSRF tokens. Custom mutations require the canonical Origin, limit JSON bodies to 8 KiB and validate strict Zod schemas. Prisma queries are parameterized, including the rate-limit upsert.
- Rate limits use PostgreSQL with fixed 15-minute buckets. Limits apply per operation globally and per account or token. A trusted, overwritten IP header enables per-IP limits. Configure ingress traffic and body limits for public deployments.
- The app generates verification and reset tokens with a cryptographically secure random source. SHA-256 digests are stored in PostgreSQL. Links carry the raw value in a browser fragment. Verification links expire after 24 hours and reset links after 30 minutes. Password and verification mutations claim tokens within their database transactions.
- Security headers include anti-framing, no-sniff, a restricted referrer policy, a permissions policy, baseline CSP and HSTS on HTTPS deployments. Provider errors and unexpected exceptions return safe messages. Audit events cover provisioning, successful login and logout, account creation, email verification, password updates and profile updates.

## Deployment operations

Set a canonical HTTPS origin, share the Auth.js secret across replicas, and store secrets in the hosting secret manager. Configure the database pool against the instance count and verify connection encryption at the provider. Make the ingress replace the trusted client-IP header and enforce public traffic limits.

Delete expired rate-limit and verification rows periodically. Apply a retention policy to old reset rows and audit records according to the deployment's requirements. Keep the development mail directory private and clear it after testing.

The local mail adapter is for local development and testing. Resend delivery is best-effort after the response. Monitor delivery failures and plan for a durable outbox before relying on automated retries. Administrative MFA, a full CSP for scripts, and an operational security review remain deployment follow-ups.

## Phase 2 access and media

- Verified-owner guards apply at owner API and page entry points. Mutations lock and verify the venue owner on the server, then validate subresources against the locked venue or pitch. The request schemas reject unknown mutable fields.
- Admin-only transitions validate the current state and append audit events in the same transaction. The operator owner-verification command requires an active owner with a verified email and records a separate audit event.
- Public projections include published venue contact details entered for display and omit private owner identity, storage keys and audit rows. Local image URLs enforce the venue's visibility or owner/admin access. Cloudinary URLs should be treated as externally shareable once issued.
- Image uploads are origin-checked, rate-limited and bounded before decoding. The server validates decoded format, pixels, animation and MIME, strips metadata, and converts files to WebP. Cloudinary credentials stay server-side. Image references and cleanup changes commit transactionally.
- Public search, public availability, management writes, favorites and moderation use database-backed rate limits. Consent precedes browser geolocation. The availability job uses a distinct bearer secret and supports resumable batches.
- Schedule, price, and inventory mutations acquire venue and pitch locks in that order. Held and booked rows remain protected, and PostgreSQL rejects overlapping UTC ranges.

## Phase 3

Booking, payment, notification, receipt and calendar routes scope data to the authenticated customer. Owner add-on actions reuse verified-owner and venue ownership checks. Checkout never consumes card numbers, CVV or UPI credentials. Checkout and webhook signatures use different server secrets. Mutation origin checking remains enabled on browser endpoints. Internal workers authenticate with a separate bearer secret.

Booking and payment invariants are enforced using database locks, conditional writes and uniqueness constraints. The booking quote is recomputed before any hold. A capture with the wrong amount or currency is recorded for compensation. Webhook records store relevant provider identifiers only. Logs and user-facing errors omit provider payloads and credentials.

## Operations controls

Operational reads use venue-scoped predicates. Mutations enforce same-origin JSON requests, per-account rate limits, resource permission and current staff access. Staff and attendance tokens are random, hashed, expire and are consumed atomically. Customer booking DTOs omit internal notes and operator IDs. CSV exports sanitize spreadsheet expressions, bound rows and write audit events. Finance entries are immutable, payment refund allocations are bounded by PostgreSQL, and external payment and email calls execute after commit.
