# API

Custom endpoints return JSON with `Cache-Control: no-store`. Send `Content-Type: application/json` and the exact configured `APP_URL` in the `Origin` header for custom mutations. Browser requests set Origin automatically. Authenticated endpoints use the Auth.js session cookie.

| Method   | Path                            | Request                                                 | Success                                            |
| -------- | ------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| GET      | `/api/health`                   | None                                                    | 200, application and PostgreSQL reachable          |
| POST     | `/api/auth/register`            | `name`, `email`, `password`                             | 201, customer and verification instructions        |
| POST     | `/api/auth/register-owner`      | Customer fields plus `businessName` and `businessPhone` | 201, owner with pending review                     |
| GET/POST | `/api/auth/[...nextauth]`       | Auth.js provider and session protocol                   | Auth.js responses, including redirects and cookies |
| POST     | `/api/auth/forgot-password`     | `email`                                                 | 200, generic reset acknowledgement                 |
| POST     | `/api/auth/reset-password`      | `token`, `password`                                     | 200, password reset and sessions revoked           |
| POST     | `/api/auth/verify-email`        | `token`, `password`                                     | 200, verified email                                |
| POST     | `/api/auth/resend-verification` | `email`, `password`                                     | 200, generic verification acknowledgement          |
| GET      | `/api/users/me`                 | Session cookie                                          | 200, safe profile fields                           |
| PATCH    | `/api/users/me`                 | Session cookie, `name` and/or `phone`                   | 200, updated profile                               |
| PATCH    | `/api/users/me/password`        | Session cookie, `currentPassword`, `password`           | 200, changed password and sessions revoked         |

Registration rejects unsupported fields, including any supplied role or status. The owner endpoint assigns `OWNER` and creates the pending business profile atomically. Pass `null` or an empty string to clear a phone number. Profile updates preserve an omitted field. Verification and reset tokens are extracted from the URL fragment on the email landing pages and sent in a POST body.

```json
{
  "success": true,
  "message": "PitchMate is healthy.",
  "data": { "status": "ok" }
}
```

```json
{
  "success": false,
  "message": "Check the information you entered.",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "password", "message": "Use at least 12 characters." }
    ]
  }
}
```

Error statuses include 400 for malformed JSON, expired links or incorrect current password, 401 for missing or revoked sessions, 403 for forbidden origins or resources, 409 for duplicate emails and account conflicts, 413 for oversized bodies, 415 for unsupported media, 422 for invalid fields, 429 for rate limits and 503 for an unavailable health dependency. Unexpected exceptions map to a generic 500.

```bash
curl --json '{"name":"Anika Rao","email":"anika@example.test","password":"example-only-passphrase"}' \
  -H 'Origin: http://localhost:3000' \
  http://localhost:3000/api/auth/register
```

## Phase 2 marketplace

JSON body and error conventions remain the same. Public list routes accept a one-based `page`. Paginated responses include `pagination.page`, `size`, `total`, and `pages`. Time intervals use local minutes from midnight, and a closing value of 1440 denotes the end of the local date. Monetary fields use integer paise.

| Methods            | Path                                                                                                                                  | Purpose                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| GET                | `/api/venues`                                                                                                                         | Filtered, sorted public venue search                          |
| GET                | `/api/venues/[slug]`, `/api/venues/[slug]/pitches`                                                                                    | Published venue and active pitches                            |
| GET                | `/api/pitches/[pitchId]/availability`                                                                                                 | Public slots for `date=YYYY-MM-DD` in the venue timezone      |
| GET                | `/api/amenities`, `/api/locations/cities`                                                                                             | Active amenities and cities with public inventory             |
| GET, POST          | `/api/owner/venues`                                                                                                                   | Owner listing and draft creation                              |
| GET, PATCH, DELETE | `/api/owner/venues/[id]`                                                                                                              | Read, edit, or archive an owned venue                         |
| POST               | `/api/owner/venues/[id]/submit`, `/api/owner/venues/[id]/publish`                                                                     | Submit for review or publish approved listing                 |
| GET, POST          | `/api/owner/venues/[id]/pitches`                                                                                                      | List or add pitches                                           |
| PATCH, DELETE      | `/api/owner/pitches/[id]`                                                                                                             | Update or deactivate pitch                                    |
| GET, PUT           | `/api/owner/pitches/[id]/schedule`                                                                                                    | Read or replace weekly `hours`                                |
| GET, POST          | `/api/owner/pitches/[id]/exceptions`                                                                                                  | List or add date overrides                                    |
| DELETE             | `/api/owner/pitches/[id]/exceptions/[exceptionId]`                                                                                    | Remove an override                                            |
| GET, POST          | `/api/owner/pitches/[id]/pricing`                                                                                                     | List or add rules                                             |
| PATCH, DELETE      | `/api/owner/pricing/[id]`                                                                                                             | Modify or remove a rule                                       |
| GET                | `/api/owner/pitches/[id]/slots`                                                                                                       | Inspect slots for a venue-local date                          |
| POST               | `/api/owner/pitches/[id]/slots/generate`                                                                                              | Reconcile the rolling window                                  |
| POST               | `/api/owner/pitches/[id]/slots/block`, `/api/owner/pitches/[id]/slots/unblock`                                                        | Change available or blocked slots using `slotIds`             |
| POST               | `/api/owner/venues/[id]/images`                                                                                                       | Controlled multipart upload with `file` and `altText`         |
| PATCH              | `/api/owner/venues/[id]/images/reorder`                                                                                               | Set full gallery order using `imageIds`                       |
| PATCH, DELETE      | `/api/owner/venues/[id]/images/[imageId]`                                                                                             | Set cover, edit alt text, or remove image                     |
| GET, POST          | `/api/favorites`                                                                                                                      | Read or save published venues using `venueId`                 |
| DELETE             | `/api/favorites/[venueId]`                                                                                                            | Remove an owned favorite                                      |
| GET                | `/api/admin/venues`, `/api/admin/venues/[id]`                                                                                         | Review listings, owners and audit history                     |
| POST               | `/api/admin/venues/[id]/approve`, `/api/admin/venues/[id]/reject`, `/api/admin/venues/[id]/suspend`, `/api/admin/venues/[id]/restore` | Moderate a venue; rejection requires `reason`                 |
| POST               | `/api/jobs/availability`                                                                                                              | Authenticated rolling-generation batch with optional `cursor` |
| GET                | `/api/venue-media/[id]`                                                                                                               | Local-only uploaded image delivery with venue access checks   |

Public search accepts `q`, `city`, `locality`, `date`, `from`, `until`, `pitchType`, `surfaceType`, `setting`, `capacity`, `minPrice`, `maxPrice`, comma-separated amenity slugs, `lat`, `lng`, and `sort`. Sort keys are `relevance`, `price-asc`, `price-desc`, `recent`, `name`, and `distance`. A dated query uses matching available slot rates. An undated query uses base hourly rates. `from` and `until` use `HH:mm` on the selected date, and the public API accepts `24:00` as an upper bound.

Unauthorized ownership returns 404. Anonymous protected calls return 401 and authenticated role violations return 403. Invalid transitions, protected inventory, ambiguous pricing, and duplicate records return 409. File uploads may return 413, 415, or 422 for size, request format, or invalid image content.
