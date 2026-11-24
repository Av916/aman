import { getPrisma } from "@/lib/prisma";
import { platformMetrics } from "@/modules/admin/operations";
import { requireDashboardRole } from "@/lib/auth";
import type { Metadata } from "next";
import { Dashboard } from "@/components/layouts/dashboard";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  if (section && section !== "overview")
    return <Dashboard role="ADMIN" section={section} />;
  const actor = await requireDashboardRole("ADMIN");
  const totals = await platformMetrics(actor);
  const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
      currency: "INR",
      style: "currency",
    }).format(paise / 100);
  const cards = [
    [
      "Registered accounts",
      totals.customers + totals.owners + (await getAdminCount()),
    ],
    ["Registered customers", totals.customers],
    ["Owners", totals.owners],
    ["Active venues", totals.active],
    ["Venue approvals pending", totals.pending],
    ["Confirmed booking records", totals.confirmed],
    ["Gross booking value", inr(totals.gross)],
    ["Captured online", inr(totals.captured)],
    ["Recorded offline", inr(totals.offline)],
    ["Platform fees", inr(totals.platformFee)],
    ["Processed refunds", inr(totals.refunds)],
    ["Cancellation rate", totals.cancellationRate.toFixed(2) + "%"],
  ];
  return (
    <Dashboard
      role="ADMIN"
      pageTitle="Platform overview"
      pageDescription="Venue approvals, booking activity and financial totals."
      content={
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <p className="text-sm text-muted">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      }
    />
  );
}

const getAdminCount = () =>
  getPrisma().user.count({ where: { role: "ADMIN" } });
