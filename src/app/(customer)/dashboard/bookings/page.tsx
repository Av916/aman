import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireDashboardRole } from "@/lib/auth";
import { Dashboard } from "@/components/layouts/dashboard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { Pagination } from "@/components/venues/pagination";
import {
  BookingActions,
  BookingSummary,
} from "@/components/bookings/booking-summary";
import { human } from "@/components/venues/format";
import { bookingList } from "@/modules/bookings/booking.repository";
import { bookingListQuery } from "@/modules/bookings/booking.validation";
const tabs = {
  CONFIRMED: "Upcoming",
  COMPLETED: "Completed",
  CHECKED_IN: "Checked in",
  RESCHEDULED: "Rescheduled",
  NO_SHOW: "No-show",
  PENDING_PAYMENT: "Pending payment",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
} as const;
export const metadata = { title: "My Bookings" };
export default async function BookingHistory({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireDashboardRole("CUSTOMER");
  const parsed = bookingListQuery.safeParse(await searchParams);
  const { status, page } = parsed.success
    ? parsed.data
    : bookingListQuery.parse({});
  const { bookings, pagination } = await bookingList(user.id, status, page);
  return (
    <Dashboard
      role="CUSTOMER"
      section="bookings"
      pageDescription="Review reservations, resume payment, and download receipts."
      content={
        <div className="grid gap-4">
          <nav aria-label="Booking status" className="flex flex-wrap gap-2">
            {Object.entries(tabs).map(([key, label]) => (
              <Button
                key={key}
                variant={key === status ? "default" : "outline"}
                asChild
              >
                <Link
                  aria-current={key === status ? "page" : undefined}
                  href={`/dashboard/bookings?status=${key}`}
                >
                  {label}
                </Link>
              </Button>
            ))}
          </nav>
          {bookings.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {bookings.map((item) => (
                <article key={item.id} className="grid content-start gap-2">
                  <BookingSummary booking={item} />
                  <p className="text-sm font-bold">
                    Payment ·{" "}
                    {item.confirmedPayment?.status || item.payments[0]?.status
                      ? human(
                          item.confirmedPayment?.status ??
                            item.payments[0].status,
                        )
                      : "Awaiting payment"}
                  </p>
                  <BookingActions booking={item} details />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No bookings in this view"
              description="Explore cricket turfs and reserve a pitch to see it here."
              icon={CalendarDays}
            />
          )}
          <Pagination
            href="/dashboard/bookings"
            params={`status=${status}`}
            page={page}
            pages={pagination.pages}
          />
        </div>
      }
    />
  );
}
