"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BookingSource,
  BookingStatus,
  PaymentStatus,
} from "@/generated/prisma/enums";
import type {
  operationVenues,
  reservationList,
} from "@/modules/operations/queries";
import { BookingDetails } from "./booking-actions";
import {
  Field,
  formatMoney,
  formatTime,
  gridClass,
  inputClass,
  LoadState,
  panelClass,
  readable,
  SimpleTable,
  Status,
  paymentBadge,
  useOperation,
  type Json,
} from "./shared";

export function ReservationWorkspace({
  venues,
  reference = "",
}: {
  venues: Json<Awaited<ReturnType<typeof operationVenues>>>;
  reference?: string;
}) {
  const [query, setQuery] = useState(
    reference ? new URLSearchParams({ search: reference }).toString() : "",
  );
  const [page, setPage] = useState(1);
  const [venueId, setVenueId] = useState("");
  const [selected, setSelected] = useState<string>();
  const state = useOperation<Json<Awaited<ReturnType<typeof reservationList>>>>(
    `/api/owner/bookings?page=${page}&${query}`,
  );
  return (
    <div className="grid gap-5">
      <form
        className={`${panelClass} ${gridClass}`}
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          setQuery(
            new URLSearchParams(
              [...values]
                .filter(([, value]) => value)
                .map(([key, value]) => [key, String(value)]),
            ).toString(),
          );
          setPage(1);
        }}
      >
        <Field label="Search">
          <input
            name="search"
            defaultValue={reference}
            className={inputClass}
            maxLength={80}
            placeholder="Reference or customer"
          />
        </Field>
        <Field label="Venue">
          <select
            name="venueId"
            value={venueId}
            onChange={(event) => setVenueId(event.target.value)}
            className={inputClass}
          >
            <option value="">All assigned venues</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pitch">
          <select key={venueId} name="pitchId" className={inputClass}>
            <option value="">All pitches</option>
            {venues
              .filter((venue) => !venueId || venueId === venue.id)
              .flatMap((venue) =>
                venue.pitches.map((pitch) => (
                  <option key={pitch.id} value={pitch.id}>
                    {pitch.name}
                  </option>
                )),
              )}
          </select>
        </Field>
        <Field label="Booking status">
          <select name="status" className={inputClass}>
            <option value="">All statuses</option>
            {Object.keys(BookingStatus).map((value) => (
              <option key={value} value={value}>
                {readable(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment status">
          <select name="payment" className={inputClass}>
            <option value="">All payment statuses</option>
            {[...Object.keys(PaymentStatus), "UNPAID"].map((value) => (
              <option key={value} value={value}>
                {readable(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select name="source" className={inputClass}>
            <option value="">All sources</option>
            {Object.keys(BookingSource).map((value) => (
              <option key={value} value={value}>
                {readable(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input name="from" className={inputClass} type="date" />
        </Field>
        <Field label="Through">
          <input name="to" className={inputClass} type="date" />
        </Field>
        <Field label="Sort">
          <select name="sort" className={inputClass}>
            <option value="desc">Latest start first</option>
            <option value="asc">Earliest start first</option>
          </select>
        </Field>
        <Button type="submit">Apply filters</Button>
        <Button asChild variant="outline">
          <Link href="/owner/calendar">Open calendar</Link>
        </Button>
      </form>
      {!state.data ? (
        <LoadState error={state.error} />
      ) : (
        <>
          <SimpleTable
            columns={[
              "Reservation",
              "Customer",
              "Venue / pitch",
              "Start / duration",
              "Source",
              "Booking",
              "Payment",
              "Total",
            ]}
            rows={state.data.bookings.map((booking) => [
              <button
                key="open"
                className="font-bold underline"
                onClick={() => setSelected(booking.id)}
              >
                {booking.bookingNumber}
              </button>,
              booking.customerName,
              booking.venueName + " / " + booking.pitchName,
              `${formatTime(booking.startAt, booking.timezone, true)} · ${booking.durationMinutes} min`,
              readable(booking.bookingSource),
              <Status key="status" value={booking.status} />,
              <Status key="payment" value={paymentBadge(booking)} />,
              formatMoney(booking.totalAmount),
            ])}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted">
              Page {page} · {state.data.total} reservations
            </span>
            <Button
              variant="outline"
              disabled={page * state.data.size >= state.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
      {selected && (
        <BookingDetails
          id={selected}
          onClose={() => setSelected(undefined)}
          onChange={state.reload}
        />
      )}
    </div>
  );
}
