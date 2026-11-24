"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { venueRequest } from "@/components/venues/api-client";
import type { calendar, operationVenues } from "@/modules/operations/queries";
import {
  ActionForm,
  Dialog,
  Field,
  formatMoney,
  formatTime,
  inputClass,
  gridClass,
  panelClass,
  dayAt,
  dayOffset,
  LoadState,
  Status,
  paymentBadge,
  useOperation,
  type Json,
} from "./shared";
import { BookingDetails, offlineMethods, type Move } from "./booking-actions";

type Venues = Json<Awaited<ReturnType<typeof operationVenues>>>;
type Calendar = Json<Awaited<ReturnType<typeof calendar>>>;
type Slot = Calendar["slots"][number];

export function CalendarWorkspace({ venues }: { venues: Venues }) {
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const zone = venues.find((v) => v.id === venueId)?.timezone ?? "Asia/Kolkata";
  const [date, setDate] = useState(() => dayAt(new Date(), zone));
  const [view, setView] = useState("week");
  const [pitch, setPitch] = useState("");
  const [status, setStatus] = useState("");
  const [details, setDetails] = useState<string>();
  const [slot, setSlot] = useState<Slot>();
  const [move, setMove] = useState<Move>();
  const days =
    view === "month"
      ? Number(dayOffset(date.slice(0, 7) + "-01", 32).slice(8))
      : view === "day"
        ? 1
        : 7;
  const start = view === "month" ? date.slice(0, 7) + "-01" : date;
  const end =
    view === "month"
      ? dayOffset(dayOffset(start, 32).slice(0, 7) + "-01", -1)
      : dayOffset(start, days - 1);
  const params = new URLSearchParams({ venueId, from: start, to: end });
  if (pitch) params.set("pitchId", pitch);
  if (status) params.set("status", status);
  const { data, error, reload } = useOperation<Calendar>(
    venueId ? `/api/owner/calendar?${params}` : "",
    20_000,
  );
  if (!venues.length)
    return (
      <p className={panelClass}>
        There are no venues assigned to this workspace.
      </p>
    );
  const interval = view === "month" ? 30 : days;
  const showSlot = (item: Slot) => {
    if (move) {
      if (
        item.pitchId === move.pitchId &&
        (item.status === "AVAILABLE" || item.activeBookingId === move.id)
      )
        setMove({ ...move, slots: [item.id] });
      return;
    }
    setSlot(item);
  };
  const slotButton = (item: Slot) => (
    <button
      key={item.id}
      onClick={() => showSlot(item)}
      onDragOver={(event) => {
        if (item.status === "AVAILABLE") event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const [id, pitchId] = event.dataTransfer
          .getData("text/plain")
          .split(":");
        if (id && pitchId === item.pitchId)
          setMove({ id, pitchId, slots: [item.id] });
      }}
      className="grid w-full gap-1 rounded-lg border border-border bg-background px-3 py-2 text-left hover:border-brand-dot focus-visible:outline-2"
    >
      <span className="text-sm font-semibold">
        {formatTime(item.startAt, zone)} · {item.pitch.name}
      </span>
      <Status value={item.status === "BLOCKED" ? "MAINTENANCE" : item.status} />
    </button>
  );
  const bookingButton = (item: Calendar["bookings"][number]) => (
    <button
      key={item.id}
      draggable={item.status === "CONFIRMED"}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", `${item.id}:${item.pitchId}`);
      }}
      onClick={() => setDetails(item.id)}
      className="grid w-full gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-left hover:border-brand-dot focus-visible:outline-2"
    >
      <span className="text-sm font-semibold">{item.customerName}</span>
      <span className="text-xs text-muted">
        {formatTime(item.startAt, zone)}–{formatTime(item.endAt, zone)} ·{" "}
        {item.pitchName}
      </span>
      <span className="text-xs text-muted">
        {item.bookingNumber} · {item.bookingSource.replaceAll("_", " ")}
      </span>
      <span className="flex flex-wrap gap-1">
        <Status value={item.status} />
        <Status value={paymentBadge(item)} />
      </span>
    </button>
  );
  return (
    <div className="grid gap-4">
      <div className={`${panelClass} ${gridClass}`}>
        <Field label="Venue">
          <select
            className={inputClass}
            value={venueId}
            onChange={(event) => {
              setVenueId(event.target.value);
              setPitch("");
            }}
          >
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pitch">
          <select
            className={inputClass}
            value={pitch}
            onChange={(event) => setPitch(event.target.value)}
          >
            <option value="">All pitches</option>
            {venues
              .find((v) => v.id === venueId)
              ?.pitches.map((pitch) => (
                <option key={pitch.id} value={pitch.id}>
                  {pitch.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Booking status">
          <select
            className={inputClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "PENDING_PAYMENT",
              "CONFIRMED",
              "CHECKED_IN",
              "COMPLETED",
              "CANCELLED",
              "NO_SHOW",
              "RESCHEDULED",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input
            className={inputClass}
            type="date"
            value={date}
            onChange={(event) => {
              if (event.target.value) setDate(event.target.value);
            }}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setDate(
              view === "month"
                ? dayOffset(start, -1)
                : dayOffset(date, -interval),
            )
          }
        >
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={() => setDate(dayAt(new Date(), zone))}
        >
          Today
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setDate(
              view === "month" ? dayOffset(end, 1) : dayOffset(date, interval),
            )
          }
        >
          Next
        </Button>
        <Button variant="outline" onClick={reload}>
          Refresh
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          View
          <select
            className={inputClass}
            value={view}
            onChange={(event) => setView(event.target.value)}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="pitch">Pitch resources</option>
            <option value="list">List</option>
          </select>
        </label>
      </div>
      {move && !move.slots && (
        <div className={panelClass}>
          Select a destination slot on the original pitch.{" "}
          <Button variant="ghost" onClick={() => setMove(undefined)}>
            Cancel reschedule
          </Button>
        </div>
      )}
      {!data ? (
        <LoadState error={error} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          {view === "pitch" ? (
            <div className="flex divide-x divide-border">
              {(venues.find((item) => item.id === venueId)?.pitches ?? [])
                .filter((item) => !pitch || item.id === pitch)
                .map((item) => (
                  <section key={item.id} className="min-w-56 flex-1 p-3">
                    <h2 className="mb-3 font-bold">{item.name}</h2>
                    <div className="grid gap-2">
                      {data.bookings
                        .filter((row) => row.pitchId === item.id)
                        .map(bookingButton)}
                      {data.slots
                        .filter(
                          (row) =>
                            row.pitchId === item.id &&
                            (!row.activeBookingId ||
                              move?.id === row.activeBookingId),
                        )
                        .map(slotButton)}
                    </div>
                  </section>
                ))}
            </div>
          ) : (
            <div
              className={
                view === "list" || view === "day" || view === "month"
                  ? "grid divide-y divide-border"
                  : "flex divide-x divide-border"
              }
            >
              {Array.from(
                { length: view === "month" ? Number(end.slice(8)) : days },
                (_, i) => dayOffset(start, i),
              ).map((day) => {
                const bookings = data.bookings.filter(
                  (item) =>
                    dayAt(new Date(item.startAt), zone) <= day &&
                    dayAt(new Date(+new Date(item.endAt) - 1), zone) >= day,
                );
                const slots = data.slots.filter(
                  (item) =>
                    dayAt(new Date(item.startAt), zone) <= day &&
                    dayAt(new Date(+new Date(item.endAt) - 1), zone) >= day &&
                    (!item.activeBookingId ||
                      move?.id === item.activeBookingId),
                );
                const heading = new Intl.DateTimeFormat("en-IN", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                }).format(new Date(day + "T00:00:00Z"));
                return (
                  <section
                    key={day}
                    className={`p-3 ${view === "week" ? "min-w-48 flex-1" : ""}`}
                  >
                    <h2 className="mb-2 font-bold">{heading}</h2>
                    {view === "month" ? (
                      <button
                        onClick={() => {
                          setDate(day);
                          setView("day");
                        }}
                        className="text-sm underline"
                      >
                        {bookings.length} bookings ·{" "}
                        {
                          slots.filter((item) => item.status === "AVAILABLE")
                            .length
                        }{" "}
                        open slots
                      </button>
                    ) : (
                      <div
                        className={
                          view === "week"
                            ? "grid gap-2"
                            : "grid gap-2 sm:grid-cols-3"
                        }
                      >
                        {bookings.map(bookingButton)}
                        {slots.map(slotButton)}
                        {!bookings.length && !slots.length && (
                          <p className="text-sm text-muted">
                            No scheduled slots.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
      {details && (
        <BookingDetails
          id={details}
          onClose={() => setDetails(undefined)}
          onChange={reload}
          onMove={(value) => {
            setDetails(undefined);
            setMove(value);
          }}
        />
      )}
      {slot && data && (
        <SlotDialog
          initial={slot}
          data={data}
          zone={zone}
          onClose={() => setSlot(undefined)}
          onChange={() => {
            setSlot(undefined);
            reload();
          }}
        />
      )}
      {move?.slots && data && (
        <MoveDialog
          move={move}
          data={data}
          zone={zone}
          onClose={() => setMove(undefined)}
          onChange={() => {
            setMove(undefined);
            reload();
          }}
        />
      )}
    </div>
  );
}

function SlotOptions({
  slots,
  value,
  onChange,
  zone,
}: {
  slots: Slot[];
  value: string[];
  onChange: (ids: string[]) => void;
  zone: string;
}) {
  return (
    <fieldset className="grid max-h-40 grid-cols-2 gap-2 overflow-auto rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-semibold">
        Consecutive time slots
      </legend>
      {slots.map((slot) => (
        <label key={slot.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includes(slot.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...value, slot.id]
                  : value.filter((id) => id !== slot.id),
              )
            }
          />
          {formatTime(slot.startAt, zone, true)}
        </label>
      ))}
    </fieldset>
  );
}

function SlotDialog({
  initial,
  data,
  zone,
  onClose,
  onChange,
}: {
  initial: Slot;
  data: Calendar;
  zone: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const [ids, setIds] = useState([initial.id]);
  const [identity, setIdentity] = useState("guest");
  const [manual, setManual] = useState(initial.status !== "BLOCKED");
  const [pricing, setPricing] = useState<{
    fingerprint: string;
    totalAmount: number;
  }>();
  const [captured, setCaptured] = useState<object>();
  const [idempotency, setIdempotency] = useState("");
  const slots = data.slots.filter(
    (item) =>
      item.pitchId === initial.pitchId &&
      item.status === "AVAILABLE" &&
      new Date(item.startAt) > new Date() &&
      Math.abs(+new Date(item.startAt) - +new Date(initial.startAt)) <
        6 * 3_600_000,
  );
  return (
    <Dialog
      title={
        initial.status === "BLOCKED" ? "Maintenance block" : "New reservation"
      }
      onClose={onClose}
    >
      <p className="mb-4 text-sm">
        {initial.pitch.name} · {formatTime(initial.startAt, zone, true)}
        {initial.blockReason ? ` · ${initial.blockReason}` : ""}
      </p>
      {initial.status !== "BLOCKED" && (
        <div className="mb-4 flex gap-2">
          <Button
            variant={manual ? "default" : "outline"}
            onClick={() => setManual(true)}
          >
            Manual booking
          </Button>
          <Button
            variant={manual ? "outline" : "default"}
            onClick={() => setManual(false)}
          >
            Block time
          </Button>
        </div>
      )}
      {manual ? (
        pricing && captured ? (
          <ActionForm
            label="Confirm reservation"
            submit={async () => {
              await venueRequest(
                "/api/owner/bookings/manual",
                "POST",
                { ...captured, quoteFingerprint: pricing.fingerprint },
                { "Idempotency-Key": idempotency },
              );
              onChange();
            }}
          >
            <p>
              Total <b>{formatMoney(pricing.totalAmount)}</b>
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPricing(undefined)}
            >
              Edit booking details
            </Button>
          </ActionForm>
        ) : (
          <ActionForm
            label="Calculate price"
            disabled={!ids.length}
            submit={async (form) => {
              const addons = data.addons
                .map((item) => ({
                  addonId: item.id,
                  quantity: Number(form.get(item.id)) || 0,
                }))
                .filter((item) => item.quantity);
              const selection = {
                pitchId: initial.pitchId,
                slotIds: ids,
                addons,
              };
              const { quote } = await venueRequest<{
                quote: { fingerprint: string; totalAmount: number };
              }>("/api/owner/bookings/quote", "POST", selection);
              const email = String(form.get("email") ?? "").trim();
              setCaptured({
                ...selection,
                identity:
                  identity === "guest"
                    ? {
                        type: "guest",
                        name: form.get("name"),
                        phone: form.get("phone"),
                        ...(email ? { email } : {}),
                      }
                    : { type: "customer", email },
                source: form.get("source"),
                paymentMethod: form.get("payment"),
                playerCount: Number(form.get("count")),
                notes: form.get("notes"),
              });
              setIdempotency(crypto.randomUUID());
              setPricing(quote);
            }}
          >
            <SlotOptions
              slots={slots}
              value={ids}
              onChange={setIds}
              zone={zone}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer type">
                <select
                  className={inputClass}
                  value={identity}
                  onChange={(event) => setIdentity(event.target.value)}
                >
                  <option value="guest">Guest</option>
                  <option value="customer">Registered customer</option>
                </select>
              </Field>
              {identity === "guest" && (
                <>
                  <Field label="Guest name">
                    <input
                      className={inputClass}
                      name="name"
                      minLength={2}
                      maxLength={80}
                      required
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      className={inputClass}
                      name="phone"
                      type="tel"
                      required
                    />
                  </Field>
                </>
              )}
              <Field label="Email">
                <input
                  className={inputClass}
                  type="email"
                  name="email"
                  required={identity === "customer"}
                />
              </Field>
              <Field label="Booking source">
                <select className={inputClass} name="source">
                  <option value="WALK_IN">Walk-in</option>
                  <option value="PHONE">Phone</option>
                  <option value="OWNER_MANUAL">Owner manual</option>
                </select>
              </Field>
              <Field label="Payment method">
                <select className={inputClass} name="payment">
                  <option value="UNPAID">Unpaid</option>
                  {identity === "customer" && (
                    <option value="RAZORPAY">
                      Send secure Razorpay checkout
                    </option>
                  )}
                  {offlineMethods.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Players">
                <input
                  className={inputClass}
                  type="number"
                  name="count"
                  min={1}
                  max={500}
                  defaultValue={2}
                  required
                />
              </Field>
            </div>
            {data.addons.length > 0 && (
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="text-sm font-semibold">
                  Equipment and services
                </legend>
                {data.addons.map((item) => (
                  <Field
                    key={item.id}
                    label={`${item.name} · ${formatMoney(item.price)}`}
                  >
                    <input
                      className={inputClass}
                      type="number"
                      name={item.id}
                      min={0}
                      max={item.pricingType === "PER_QUANTITY" ? 20 : 1}
                      defaultValue={0}
                    />
                  </Field>
                ))}
              </fieldset>
            )}
            <Field label="Internal notes">
              <textarea className={inputClass} name="notes" maxLength={500} />
            </Field>
          </ActionForm>
        )
      ) : (
        <ActionForm
          label={initial.status === "BLOCKED" ? "Unblock slot" : "Block slot"}
          submit={async (form) => {
            await venueRequest(
              `/api/owner/calendar/slots/${initial.id}`,
              "POST",
              {
                block: initial.status !== "BLOCKED",
                reason: form.get("reason"),
              },
            );
            onChange();
          }}
        >
          <Field label="Maintenance reason">
            <input
              name="reason"
              className={inputClass}
              required
              minLength={5}
              maxLength={300}
            />
          </Field>
        </ActionForm>
      )}
    </Dialog>
  );
}

function MoveDialog({
  move,
  data,
  zone,
  onClose,
  onChange,
}: {
  move: Move;
  data: Calendar;
  zone: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const [ids, setIds] = useState(move.slots ?? []);
  const [quote, setQuote] = useState<{
    quote: { fingerprint: string };
    priceDifference: number;
    replacementAmount: number;
    amountDue: number;
  }>();
  const slots = data.slots.filter(
    (item) =>
      item.pitchId === move.pitchId &&
      (item.status === "AVAILABLE" || item.activeBookingId === move.id) &&
      new Date(item.startAt) > new Date(),
  );
  const base = `/api/owner/bookings/${move.id}`;
  return (
    <Dialog title="Reschedule reservation" onClose={onClose}>
      <ActionForm
        label={quote ? "Confirm reschedule" : "Calculate replacement price"}
        disabled={!ids.length}
        submit={async () => {
          const selection = { pitchId: move.pitchId, slotIds: ids, addons: [] };
          if (!quote)
            return setQuote(
              await venueRequest(base + "/reschedule-quote", "POST", selection),
            );
          await venueRequest(base + "/reschedule", "POST", {
            ...selection,
            quoteFingerprint: quote.quote.fingerprint,
          });
          onChange();
        }}
      >
        <SlotOptions
          zone={zone}
          slots={slots}
          value={ids}
          onChange={(value) => {
            setIds(value);
            setQuote(undefined);
          }}
        />
        {quote && (
          <p className="text-sm">
            Replacement {formatMoney(quote.replacementAmount)} · Difference{" "}
            {formatMoney(quote.priceDifference)}.
            {quote.amountDue > 0 &&
              " When an additional online payment is required, the customer can pay from My Bookings."}
          </p>
        )}
      </ActionForm>
    </Dialog>
  );
}
