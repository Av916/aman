# Architecture

PitchMate uses a modular monolith in a single Next.js App Router deployment. PostgreSQL is the system of record. Client components handle the interactions that need browser state, including forms, navigation dialogs, theme selection and authentication actions. Landing and dashboard content uses Server Components.

```mermaid
flowchart LR
  Browser --> App["Next.js App Router"]
  App --> Pages["Server Components"]
  App --> Routes["Route handlers"]
  Routes --> Boundary["Validation and response mapping"]
  Pages --> Guards["Session and role guards"]
  Boundary --> Guards
  Guards --> Services["Auth and user services"]
  Guards --> Repos["Repositories"]
  Services --> Repos
  Services --> Outbound["Account email"]
  Repos --> Prisma["Prisma 7 + pg pool"]
  Prisma --> DB[("PostgreSQL")]
  Outbound --> Delivery["Resend or local email files"]
```

Route handlers parse HTTP inputs and translate service results. Domain services coordinate account workflows. Repositories own database queries and transactions. Dashboard guards bind access to the current server-side account role, and the self-service profile API derives the target account ID from the session.

Prisma uses the generated TypeScript client in `src/generated/prisma`. Generation is part of the development, build, typecheck and Vitest commands. The process-level Prisma client reuses a PostgreSQL connection pool. JWTs carry an account ID and revocation version, while PostgreSQL supplies current role and status on authenticated requests.

Account email is scheduled after the HTTP response. Verification resend and password recovery let users retry. A durable outbox is a future delivery improvement.

## Folder structure

```text
pitchmate/
├── docs/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   ├── seed.ts
│   ├── admin.ts
│   └── provision-admin.ts
├── public/
│   ├── images/
│   └── logo/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── register-owner/
│   │   │   ├── forgot-password/
│   │   │   ├── reset-password/
│   │   │   ├── verify-email/
│   │   │   └── resend-verification/
│   │   ├── (customer)/dashboard/
│   │   ├── owner/dashboard/
│   │   ├── admin/dashboard/
│   │   ├── account/
│   │   ├── api/{auth,health,users}/
│   │   ├── fonts/
│   │   └── layout.tsx, globals.css, error.tsx, not-found.tsx
│   ├── components/{branding,forms,layouts,shared,ui}/
│   ├── config/
│   ├── constants/
│   ├── generated/prisma/
│   ├── hooks/
│   ├── lib/
│   ├── modules/{auth,users,venues,bookings,pricing,payments}/
│   ├── types/
│   └── instrumentation.ts
├── tests/{unit,integration,e2e}/
├── .env.example
├── bun.lock
├── components.json
├── docker-compose.yml
├── package.json
└── prisma.config.ts
```

`venues` and `pricing` now serve the marketplace. `bookings` and `payments` are reserved for subsequent phases. The customer, owner and admin dashboards share layout primitives and define separate navigation and server-side access rules.

## Phase 2

```mermaid
flowchart LR
  Guest["Public discovery and detail"] --> Discovery["Venue search repository"]
  Owner["Verified owner dashboard"] --> Venue["Venue and pitch services"]
  Admin["Admin reviewer"] --> Review["Venue review service"]
  Customer["Customer favorites"] --> Favorite["Favorites service"]
  Venue --> Media["Media service"]
  Media --> Storage["Cloudinary or local files"]
  Venue --> Generator["Availability reconciliation"]
  Job["Scheduled worker"] --> Generator
  Job --> Media
  Generator --> Price["Pricing rule resolution"]
  Discovery --> PG[("PostgreSQL")]
  Venue --> PG
  Review --> PG
  Favorite --> PG
  Generator --> PG
```

The new domains live under `src/modules/{venues,pitches,amenities,media,schedules,availability,pricing,favorites,admin}`. `venue.repository.ts` owns discovery, venue row locks and audit inserts. The pitch service coordinates mutations across schedules, pricing and availability. The availability module exposes a deterministic generator, reconciliation, and a bounded rolling job. Media files live outside PostgreSQL.

The main entry points are `src/app/(public)/turfs`, `src/app/owner/venues`, `src/app/admin/venues`, `src/app/(customer)/dashboard/favorites`, and their corresponding API routes. Shared marketplace UI is in `src/components/venues`. The public pages use server-side queries with URL-driven filters. Leaflet and management forms are interactive client components.

Venue descriptions, amenity assignments, and galleries use the public data cache. Every detail lookup first checks publication in PostgreSQL and includes the published row's revision in the cache key. Material edits and moderation change the revision or remove publication. Pitch schedules, prices, and slot availability use fresh database reads.
