import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VenuePhoto } from "@/components/venues/gallery";
import { human, money } from "@/components/venues/format";
import type { BookingView } from "@/modules/bookings/booking.repository";
import { PriceSummary } from "./price-summary";

export const dateTime = (value: Date, zone: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone,
  }).format(value);

export function BookingSummary({
  booking,
  showPrice = true,
  compact = false,
}: {
  booking: BookingView;
  showPrice?: boolean;
  compact?: boolean;
}) {
  const image = booking.venue.images[0];
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      {image && (
        <div className="relative aspect-[2.35] bg-highlight">
          <VenuePhoto
            src={image.imageUrl}
            alt={image.altText}
            sizes="(max-width: 960px) 90vw, 36vw"
          />
        </div>
      )}
      <div className="grid gap-4 p-5">
        <div>
          <h2 className="text-xl font-extrabold">{booking.venueName}</h2>
          <p className="mt-1 font-bold">{booking.pitchName}</p>
        </div>
        <div className="space-y-2 text-sm text-muted">
          <p className="flex items-start gap-2">
            <MapPin size={16} className="shrink-0" aria-hidden />
            {booking.venueAddress}
          </p>
          <p className="flex items-start gap-2">
            <CalendarDays size={16} className="shrink-0" aria-hidden />
            <span>
              {dateTime(booking.startAt, booking.timezone)} –{" "}
              {dateTime(booking.endAt, booking.timezone)}
              <br />
              {booking.timezone} · {booking.durationMinutes} minutes
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={booking.confirmedAt ? "green" : "neutral"}>
            {human(booking.status)}
          </Badge>
          <span className="text-sm font-bold">{booking.bookingNumber}</span>
        </div>
        {(showPrice || booking.addons.length > 0) && (
          <div className="border-t border-border pt-4">
            {booking.addons.length > 0 && (
              <ul className="mb-3 space-y-1 text-sm">
                {booking.addons.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span>
                      {item.nameSnapshot} × {item.quantity}
                    </span>
                    <span>{money(item.totalPrice)}</span>
                  </li>
                ))}
              </ul>
            )}
            {showPrice &&
              (compact ? (
                <>
                  <details className="lg:hidden">
                    <summary className="cursor-pointer font-bold">
                      Price breakdown · {money(booking.totalAmount)}
                    </summary>
                    <div className="mt-3">
                      <PriceSummary price={booking} />
                    </div>
                  </details>
                  <div className="hidden lg:block">
                    <PriceSummary price={booking} />
                  </div>
                </>
              ) : (
                <PriceSummary
                  price={booking}
                  label={
                    booking.confirmedPayment || booking.allocations.length
                      ? "Total paid"
                      : "Total payable"
                  }
                />
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function BookingActions({
  booking,
  details = false,
}: {
  booking: BookingView;
  details?: boolean;
}) {
  const eligible = ["CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW"].includes(
    booking.status,
  );
  return (
    <div className="flex flex-wrap gap-2">
      {eligible && (
        <>
          {(booking.confirmedPayment || booking.allocations.length > 0) && (
            <Button asChild variant="outline">
              <a href={`/api/bookings/${booking.id}/receipt`}>
                Download receipt
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <a href={`/api/bookings/${booking.id}/calendar`}>Add to calendar</a>
          </Button>
        </>
      )}
      {booking.status === "PENDING_PAYMENT" && (
        <Button asChild>
          <Link href={`/checkout/${booking.id}`}>Resume payment</Link>
        </Button>
      )}
      {details && (
        <Button asChild variant="outline">
          <Link href={`/bookings/${booking.id}`}>View booking</Link>
        </Button>
      )}
      <Button asChild variant="ghost">
        <Link href={`/turfs/${booking.venue.slug}?pitch=${booking.pitchId}`}>
          Book again
        </Link>
      </Button>
    </div>
  );
}
