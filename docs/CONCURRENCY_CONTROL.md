# Booking concurrency control

PostgreSQL is the inventory authority. A hold transaction takes locks in this order.

1. Lock the customer row. This serializes the active-hold limit and request idempotency across pitches.
2. Take a shared lock on the venue and then an exclusive lock on the pitch. Acquisition skips locked rows and maps contention to a 409 response. The shared venue lock permits independent pitches to be booked in parallel. Schedule changes, maintenance, and the rolling generator take exclusive locks in the same order.
3. Read and validate the latest slots under the pitch lock. Create the pending booking and claim the exact IDs with an `AVAILABLE` and unowned predicate. Require the affected count to match. The entire transaction rolls back on failure.

Payment and expiration take venue, pitch, and booking locks in that order. They never wait for the customer lock. The pitch lock serializes writes to multiple slots. Checkout confirmation conditionally updates only held intervals that still belong to the booking and have a valid deadline. Releasing a hold uses the same owner and state predicates. Prisma transaction conflicts get bounded retries.

The database enforces the pitch/start unique key, GiST overlap exclusion, slot ownership shape, and a foreign key that requires the active booking to use the same pitch. An accepted payment must belong to the same booking. The application checks capture and deadlines before committing confirmed or booked state.

The database holds immutable booking items separately from current inventory. An available slot may be rebuilt by the schedule service. The item retains its original ID, timestamps, and price when its live-slot foreign key clears.

Concurrency tests use isolated PostgreSQL. They cover 100 customers racing for one slot, overlapping multi-slot selections, a per-user hold limit across pitches, expiry racing capture, a later customer retaining ownership, and ten deliveries of one signed webhook.
