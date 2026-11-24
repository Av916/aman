import Link from "next/link";
import { Dashboard } from "@/components/layouts/dashboard";
import { requireDashboardRole } from "@/lib/auth";
import { systemStatus } from "@/modules/system/status";
import { SimpleTable } from "@/components/operations/shared";
import { SystemRecovery } from "@/components/operations/system-recovery";

const date = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "short",
  timeStyle: "short",
});

export const metadata = { title: "System operations" };
export default async function Page() {
  await requireDashboardRole("ADMIN");
  const data = await systemStatus();
  return (
    <Dashboard
      role="ADMIN"
      section="system"
      pageTitle="System operations"
      pageDescription="Scheduled work, delivery and provider exceptions."
      content={
        <div className="grid gap-6">
          <div className="flex flex-wrap gap-4">
            <Link href="/api/health/ready" className="underline">
              Readiness
            </Link>
            <Link href="/admin/system/integrity" className="underline">
              Integrity audit
            </Link>
            <Link href="/admin/refunds" className="underline">
              Refund recovery
            </Link>
          </div>
          <p>
            Failed webhook events {data.webhooks} ·{" "}
            {data.outbox
              .map((row) => `${row.status}: ${row._count}`)
              .join(" · ") || "No outbox entries"}
          </p>
          <section>
            <h2 className="mb-2 text-lg font-bold">Scheduled jobs</h2>
            <SimpleTable
              columns={["Job", "Started", "Status", "Recovery"]}
              rows={data.jobs.map((row) => [
                row.name,
                date.format(row.startedAt),
                row.status,
                ["FAILED", "INTERRUPTED"].includes(row.status) ? (
                  <SystemRecovery
                    key="recover"
                    id={row.id}
                    action="retry-job"
                  />
                ) : null,
              ])}
            />
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold">Failed deliveries</h2>
            <SimpleTable
              columns={["Event", "Attempts", "Recovery"]}
              rows={data.failedOutbox.map((row) => [
                row.eventType,
                row.attempts,
                <SystemRecovery
                  key="recover"
                  id={row.id}
                  action="retry-outbox"
                />,
              ])}
            />
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold">Payment exceptions</h2>
            <SimpleTable
              columns={["Order", "Booking", "Status", "Recovery"]}
              rows={data.orderExceptions.map((row) => [
                row.id,
                row.bookingId,
                row.status,
                <SystemRecovery
                  key="recover"
                  id={row.id}
                  action="reconcile-order"
                />,
              ])}
            />
            <SimpleTable
              columns={["Unapplied capture", "Booking", "Paise"]}
              rows={data.unappliedCaptures.map((row) => [
                row.id,
                row.bookingId,
                row.amount,
              ])}
            />
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold">Refund exceptions</h2>
            <SimpleTable
              columns={["Refund", "Booking", "Provider", "Status", "Paise"]}
              rows={data.refundExceptions.map((row) => [
                row.id,
                row.bookingId,
                row.payment.provider,
                row.status,
                row.amount,
              ])}
            />
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold">Recovery audit events</h2>
            <SimpleTable
              columns={["Action", "Resource", "Occurred"]}
              rows={data.audit.map((row) => [
                row.action,
                row.entityType,
                date.format(row.createdAt),
              ])}
            />
          </section>
        </div>
      }
    />
  );
}
