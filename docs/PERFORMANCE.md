# Performance

Public discovery preserves publication checks. Availability uses pitch and start-time indexes and authoritative slot reads. Customer history reuses its customer, status and start-time index. Owner calendar and analytics bound date ranges, use venue or pitch indexes, and aggregate in PostgreSQL. Attendance completion takes oldest eligible rows with a new status and end-time index. Worker and diagnostic batches are bounded.

Charts load on the analytics client and Razorpay Checkout loads at payment initiation. Next Image and local font files remain in the public UI. Run the analyze command for the Turbopack analyzer. Collect representative field Web Vitals before evaluating the 2.5 s LCP, 200 ms INP, and 0.1 CLS objectives.

On the isolated PostgreSQL fixture, EXPLAIN ANALYZE selected Booking_status_endAt_idx for attendance, Slot_pitchId_startAt_key for availability, and Booking_venueId_startAt_idx for the venue range lookup with sequential scans disabled. Index-path execution times were 0.062 ms, 0.086 ms and 0.030 ms. This confirms the index paths on a small sample and does not estimate hosted query planner decisions.

A single Chromium run with Pixel 7 viewport emulation measured 228 ms LCP and 0 CLS on loopback. No network or CPU throttling was applied. INP and field percentiles remain unmeasured.

The Turbopack production bundle analyzer ran successfully and wrote its interactive analysis in the isolated build directory. Re-run the analyze command to regenerate the report for a release revision.
