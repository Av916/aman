import Link from "next/link";
import { CheckCircle2, Clock, CircleAlert } from "lucide-react";
import { PublicNav } from "@/components/layouts/public-nav";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { BookingActions, BookingSummary } from "./booking-summary";
import { StatusPoll } from "./status-poll";
import { human, money } from "@/components/venues/format";
import type { BookingView } from "@/modules/bookings/booking.repository";

export function BookingResult({
  booking,
  confirmation = false,
}: {
  booking: BookingView;
  confirmation?: boolean;
}) {
  const confirmed = [
    "CONFIRMED",
    "CHECKED_IN",
    "COMPLETED",
    "NO_SHOW",
  ].includes(booking.status);
  const pending = booking.status === "PENDING_PAYMENT";
  const awaitingRefund = booking.refunds.some(
    (item) => item.status === "PENDING" || item.status === "PROCESSING",
  );
  const title = confirmed
    ? confirmation
      ? "Booking confirmed"
      : "Booking details"
    : pending
      ? "Payment pending"
      : booking.status === "EXPIRED"
        ? "Reservation expired"
        : "Reservation released";
  const Icon = confirmed ? CheckCircle2 : pending ? Clock : CircleAlert;
  const payment =
    booking.confirmedPayment?.status ??
    (booking.allocations.length ? "CAPTURED" : booking.payments[0]?.status);
  return (
    <>
      <PublicNav />
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <Breadcrumbs
          items={[
            { label: "My Bookings", href: "/dashboard/bookings" },
            { label: booking.bookingNumber },
          ]}
        />
        <div className="mb-6 grid gap-2">
          <Icon size={30} className="text-brand-dot" aria-hidden />
          <h1 className="text-4xl font-extrabold tracking-[-.05em]">{title}</h1>
          <p className="text-muted">
            {confirmed
              ? "Share your booking reference when you arrive."
              : pending
                ? "Confirmation appears once the captured payment has been verified."
                : "This reservation no longer holds any inventory."}
          </p>
          {(pending || awaitingRefund) && (
            <StatusPoll
              id={booking.id}
              status={booking.status}
              paymentStatus={payment ?? null}
              refunds={booking.refunds.map((item) => item.status).join(",")}
            />
          )}
        </div>
        <div className="grid items-start gap-5 md:grid-cols-2">
          <BookingSummary booking={booking} />
          <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-xl font-extrabold">
              Payment and booking details
            </h2>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="font-bold">Customer</dt>
                <dd>
                  {booking.customerName} · {booking.customerEmail}
                </dd>
              </div>
              <div>
                <dt className="font-bold">Payment status</dt>
                <dd>{payment ? human(payment) : "Awaiting payment"}</dd>
              </div>
              {booking.confirmedPayment && (
                <div>
                  <dt className="font-bold">Payment reference</dt>
                  <dd>{booking.confirmedPayment.providerPaymentId}</dd>
                </div>
              )}
            </dl>
            {booking.refunds.length > 0 && (
              <ul className="space-y-2 text-sm">
                {booking.refunds.map((item) => (
                  <li className="rounded-lg bg-background p-3" key={item.id}>
                    Refund {human(item.status)} · {money(item.amount)}
                    <br />
                    <span className="text-muted">{item.reason}</span>
                  </li>
                ))}
              </ul>
            )}
            {confirmed && (
              <a
                className="w-fit font-bold text-brand-dot underline"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.venueAddress)}`}
                target="_blank"
                rel="noreferrer"
              >
                Directions to venue
              </a>
            )}
            <BookingActions booking={booking} details={confirmation} />
            <Button asChild variant="ghost">
              <Link href="/turfs">Explore more turfs</Link>
            </Button>
          </section>
        </div>
      </main>
    </>
  );
}
