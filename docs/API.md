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
