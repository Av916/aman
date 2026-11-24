# Phase 2 delivery

Phase 2 adds public turf discovery, venue details and availability, favorites, verified-owner management and admin moderation. Venues support multiple independently configured pitches. Read-only availability uses rolling inventory with scheduled extension, local time conversion, maintenance status and integer paise pricing.

## Checks

Run `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, and `bun run test:e2e`. Use a separate migrated `TEST_DATABASE_URL`. The browser suite builds a production application with isolated PostgreSQL data, local email files and a private temporary image directory. Its critical flow covers owner draft creation, upload, weekly schedule, admin approval, publication, anonymous discovery, sign-in return and favorites.

## Environment and limits

Use Cloudinary in hosted environments. Loopback environments can use the local filesystem adapter. Configure an external scheduler for `bun run slots:extend` or call the authenticated batch endpoint. Public tile requests use OpenStreetMap with attribution. Hosted traffic should use a tile provider sized for its volume.

Phase 2 supports INR and 30- or 60-minute slots. Public prices are per-slot and hourly estimates. Venue approval remains a human review step, and the customer booking action is disabled. Live Cloudinary tests require provider credentials. A formal WCAG 2.2 AA audit remains pending.

## Phase 3 readiness

- [x] Unique UTC slot allocation and database overlap protection.
- [x] Stable pitch IDs, price snapshots, and held/booked states.
- [x] Booking duration limits and owner, customer, admin, and resource guards.
- [ ] Add booking, line-item and hold records with immutable quote snapshots.
- [ ] Acquire venue and pitch locks in the existing order before transitioning slots to held or booked.
- [ ] Integrate idempotent checkout and payment flows, hold expiry, and reconciliation tests.
- [ ] Record state transitions and verify simultaneous booking, schedule change, and late-payment scenarios.
