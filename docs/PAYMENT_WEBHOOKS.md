# Payment webhooks

Configure `POST /api/webhooks/razorpay` as the Razorpay webhook endpoint. Subscribe to `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, and `refund.failed`.

The handler reads bounded raw bytes, checks the hexadecimal HMAC with a constant-time comparison, and persists the provider event ID and relevant entity identifiers. Card details and provider error descriptions are discarded. The unique provider/event index handles repeated deliveries. The route acknowledges after persistence and attempts processing after the response. The scheduled job can retry the event on any application instance.

Processing leases are bounded and recover if a worker stops. The worker reads payment and refund data from Razorpay, uses the same confirmation service as checkout verification, and will not downgrade an already captured or refunded record because of a late failure event. Events that exhaust retries retain a safe failure code for operator review.

[Razorpay webhook validation](https://hdfcbank-collectnow-docs.razorpay.com/webhooks/validate-test/)
