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

## Phase 3 booking and payments

| Methods       | Path                                                                                                               | Purpose                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| POST          | `/api/bookings/quote`                                                                                              | Authoritative price for `pitchId`, `slotIds` and `addons`                |
| GET, POST     | `/api/bookings`                                                                                                    | Filtered history, or hold with quote fingerprint and `Idempotency-Key`   |
| GET, PATCH    | `/api/bookings/[id]`                                                                                               | Read the owned booking, or persist contact data and terms acknowledgment |
| GET           | `/api/bookings/[id]/status`                                                                                        | Booking, payment and compensation progress                               |
| POST          | `/api/bookings/[id]/release`                                                                                       | Release an unpaid customer hold                                          |
| GET           | `/api/bookings/[id]/receipt`, `/api/bookings/[id]/calendar`                                                        | Private PDF and ICS downloads                                            |
| GET           | `/api/venues/[venueId]/addons`                                                                                     | Active add-ons for a published venue ID                                  |
| GET, POST     | `/api/owner/venues/[id]/addons`                                                                                    | Read or create add-ons for an owned venue                                |
| PATCH, DELETE | `/api/owner/addons/[id]`                                                                                           | Edit or deactivate an add-on                                             |
| POST          | `/api/payments/create-order`, `/api/payments/verify`                                                               | Create or recover the provider order and verify checkout                 |
| GET           | `/api/payments/[id]/status`                                                                                        | Status for an owned order intent or payment ID                           |
| POST          | `/api/webhooks/razorpay`                                                                                           | Validate and persist signed Razorpay events                              |
| GET           | `/api/notifications`, `/api/notifications/unread-count`                                                            | Read the customer's updates                                              |
| PATCH         | `/api/notifications/[id]/read`, `/api/notifications/read-all`                                                      | Mark one or all notices read                                             |
| POST          | `/api/internal/jobs/expire-bookings`, `/api/internal/jobs/reconcile-payments`, `/api/internal/jobs/process-outbox` | Bearer-authenticated recovery jobs                                       |

A quote request contains the following shape.

```json
{
  "pitchId": "00000000-0000-4000-8000-000000000001",
  "slotIds": ["00000000-0000-4000-8000-000000000002"],
  "addons": []
}
```

Send the same selection to the booking POST with the quote's `fingerprint` as `quoteFingerprint` plus the `Idempotency-Key` header. A competing hold or changed price returns 409. Retrying an identical accepted key returns the original booking. A hold that expires before payment returns 410. Availability accepts `past=1` for the booking UI to show elapsed slots on the current date.

## Phase 4 operations

```text
GET /api/owner/{dashboard,calendar,analytics,bookings,staff,customers,reviews,refunds,coupons,reports}
GET /api/owner/analytics/{revenue,bookings,occupancy}
GET /api/owner/calendar/venues
POST /api/owner/calendar/slots/[id]
POST /api/owner/bookings/{quote,manual}
GET /api/owner/bookings/[id]
POST /api/owner/bookings/[id]/{check-in,complete,no-show,record-payment,resend}
POST /api/owner/bookings/[id]/{cancellation-quote,cancel,reschedule-quote,reschedule,refund}
GET /api/owner/bookings/[id]/receipt
POST /api/owner/check-in
POST /api/owner/staff/invite
PATCH, DELETE /api/owner/staff/[id]
PUT /api/owner/staff/[id]/venues
POST /api/staff/invitations/accept
GET /api/owner/customers/[id]
GET /api/owner/customers/[id]/bookings
GET, POST /api/owner/venues/[id]/cancellation-policies
PATCH /api/owner/cancellation-policies/[id]
POST /api/owner/cancellation-policies/[id]/activate
GET /api/{owner,admin}/refunds/[id]
POST /api/owner/refunds/[id]/approve
POST /api/admin/refunds/[id]/retry
POST /api/bookings/[id]/{cancellation-quote,cancel,reschedule-quote,reschedule,review}
GET /api/bookings/[id]/{refunds,check-in-token}
GET /api/venues/[slug]/reviews
PATCH /api/reviews/[id]
POST /api/reviews/[id]/report
POST /api/owner/reviews/[id]/respond
GET /api/admin/reviews
POST /api/admin/reviews/[id]/moderate
GET, POST /api/{owner,admin}/coupons
PATCH, DELETE /api/{owner,admin}/coupons/[id]
POST /api/coupons/validate
GET /api/owner/reports/{bookings,revenue,occupancy,export}
GET /api/admin/{reports,reports/export,refunds,settings}
PATCH /api/admin/{settings,users/[id],owners/[id]}
POST /api/internal/jobs/remind-bookings
```

Manual booking and refund-adjustment writes require an `Idempotency-Key` header. Cancellation writes require `confirmed: true`, the reason, and `expectedRefundAmount` in paise from the latest quote. Rescheduling passes pitch and slot IDs to the quote endpoint and supplies the returned fingerprint when confirming.
