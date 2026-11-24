# Operational reports

Owners and permitted staff can filter bookings, revenue, payments, refunds, occupancy, cancellations, customer history, and pitch performance by authorized venue, pitch, date range, and relevant booking or payment statuses. Administrators can report across venues. Customer exports additionally check customer directory access. The report output contains the data needed for each report and excludes contact fields.

Download CSV from `/owner/reports` or `/admin/reports`. Synchronous exports stop at 5,000 data rows. Narrow the date range for larger results. Cells are quoted, internal quotes escaped, and formula-like strings prefixed with an apostrophe. Exports use private, noncached responses. Each export logs actor, dataset, filters and row count.

```text
GET /api/owner/reports/export?kind=payments&venueId=<uuid>&from=2026-11-01&to=2026-11-24
```

Payment and refund reports use their own event timestamps. Booking and cancellation reports filter by the reservation’s scheduled start. The revenue timeline uses financial ledger timestamps. INR amounts are exported as integer paise.
