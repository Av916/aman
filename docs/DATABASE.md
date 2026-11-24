# Database

PostgreSQL 17 runs through Compose for local development. Prisma 7 uses `prisma-client` generation and `@prisma/adapter-pg`. The initial migration creates all Phase 1 tables, foreign keys, enums and indexes. Application dates use `timestamptz(3)`. The database pool sets its timezone to UTC.

```mermaid
erDiagram
  USER ||--o{ ACCOUNT : "links OAuth identity"
  USER ||--o{ SESSION : "supports database sessions"
  USER ||--o{ VERIFICATION_TOKEN : "verifies email"
  USER ||--o{ PASSWORD_RESET_TOKEN : "can reset"
  USER ||--o| OWNER_PROFILE : "owns"
  USER o|--o{ AUDIT_LOG : "acts in"
  USER {
    uuid id PK
    string email UK
    string passwordHash
    enum role
    enum status
    datetime emailVerified
    int sessionVersion
  }
  ACCOUNT {
    uuid id PK
    uuid userId FK
    string provider
    string providerAccountId
  }
  SESSION {
    uuid id PK
    uuid userId FK
    string sessionToken UK
  }
  VERIFICATION_TOKEN {
    string identifier FK
    string token UK
    datetime expires
  }
  PASSWORD_RESET_TOKEN {
    uuid id PK
    uuid userId FK
    string tokenHash UK
    datetime expiresAt
    datetime usedAt
  }
  OWNER_PROFILE {
    uuid id PK
    uuid userId FK,UK
    enum verificationStatus
  }
  AUDIT_LOG {
    uuid id PK
    uuid actorId FK
    string action
    string entityId
  }
  RATE_LIMIT {
    string key PK
    int count
    datetime expiresAt
  }
```

| Model                | Integrity and lifecycle                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`               | UUID ID, normalized unique email, nullable Argon2id hash, role and status indexes, profile fields, revocation counter and timestamps.                 |
| `Account`            | Unique provider/subject pair. Stores Google identity linkage. OAuth access and refresh tokens are unused by PitchMate.                                |
| `Session`            | Auth.js-compatible table for a future database-session strategy. Phase 1 uses JWT sessions.                                                           |
| `VerificationToken`  | SHA-256 digest, expiry and an email foreign key. Consuming a link removes outstanding verification links.                                             |
| `PasswordResetToken` | SHA-256 digest, UUID, expiry and consumption timestamps. A password change invalidates outstanding reset links.                                       |
| `OwnerProfile`       | Unique user foreign key, business name and phone, timestamps and indexed verification status. Creation is part of the owner registration transaction. |
| `AuditLog`           | Records actor, action, resource, optional metadata and timestamp. Actor deletion clears the foreign key while preserving the audit record.            |
| `RateLimit`          | HMAC-keyed scope and subject, attempt count and expiry. Atomic upserts serialize concurrent updates to the same bucket.                               |

Dependent account, session, verification and recovery records cascade on user deletion. User roles are `CUSTOMER`, `OWNER` and `ADMIN`. User statuses are `ACTIVE`, `SUSPENDED` and `INACTIVE`. Owner statuses are `PENDING`, `APPROVED` and `REJECTED`.

Use `bun run db:migrate` locally and `bun run db:deploy` with the migration database credentials during deployment. Keep a separate runtime role with only the table privileges the app requires. Generate Prisma Client with `bun run db:generate`. Use [the schema](../prisma/schema.prisma) as the source of field-level detail.
