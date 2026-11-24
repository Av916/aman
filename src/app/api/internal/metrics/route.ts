import { endpoint } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { assertJobAuthorization } from "@/modules/jobs/http";

export const GET = endpoint(async (request) => {
  assertJobAuthorization(request);
  const rows = await getPrisma().$queryRaw<{ name: string; value: bigint }[]>`
    SELECT 'outbox_pending' AS name, count(*) AS value FROM "OutboxEvent" WHERE status IN ('PENDING','PROCESSING')
    UNION ALL SELECT 'outbox_processing_failed', count(*) FROM "OutboxEvent" WHERE status = 'FAILED'
    UNION ALL SELECT 'refund_failed', count(*) FROM "Refund" WHERE status = 'FAILED'
    UNION ALL SELECT 'payment_reconciliation_failed', count(*) FROM "PaymentWebhookEvent" WHERE "processingStatus" = 'FAILED'
    UNION ALL SELECT 'refund_requested_24h', count(*) FROM "Refund" WHERE "createdAt" > now() - interval '24 hours'
    UNION ALL SELECT 'refund_processed_24h', count(*) FROM "Refund" WHERE "processedAt" > now() - interval '24 hours'
    UNION ALL SELECT 'payment_captured_24h', count(*) FROM "Payment" WHERE "paidAt" > now() - interval '24 hours'
    UNION ALL SELECT 'booking_confirmed_24h', count(*) FROM "Booking" WHERE "confirmedAt" > now() - interval '24 hours'
    UNION ALL SELECT 'booking_hold_expired_24h', count(*) FROM "Booking" WHERE status = 'EXPIRED' AND "holdExpiresAt" > now() - interval '24 hours'
  `;
  return new Response(
    rows
      .map(
        ({ name, value }) =>
          `# TYPE pitchmate_${name} gauge\npitchmate_${name} ${value}\n`,
      )
      .join(""),
    {
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
});
