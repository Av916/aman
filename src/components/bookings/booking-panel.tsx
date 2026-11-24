"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  VenueRequestError,
  venueRequest,
} from "@/components/venues/api-client";
import { money, slotTime, slotLabel, human } from "@/components/venues/format";
import type { PublicVenue } from "@/modules/venues/venue.types";
import type { pitchAvailability } from "@/modules/availability/service";
import type { venueAddons } from "@/modules/addons/service";
import type { quoteSelection } from "@/modules/pricing/pricing.service";
import { PriceSummary } from "./price-summary";

type Availability = Awaited<ReturnType<typeof pitchAvailability>>;
type Quote = Awaited<ReturnType<typeof quoteSelection>>;
type Slot = Availability["slots"][number];
type VenuePitch = PublicVenue["pitches"][number];

function dayOffset(day: string, offset: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function labelDay(day: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(day + "T00:00:00Z"));
}
function hourOf(value: Date, zone: string) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(value)),
  );
}

export function BookingPanel({
  slug,
  pitch,
  pitches,
  initial,
  addons,
  role,
}: {
  slug: string;
  pitch: VenuePitch;
  pitches: VenuePitch[];
  initial: Availability;
  addons: Awaited<ReturnType<typeof venueAddons>>;
  role?: string;
}) {
  const router = useRouter();
  const [availability, setAvailability] = useState(initial);
  const [following, setFollowing] = useState<Slot[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [coupon, setCoupon] = useState("");
  const [couponDraft, setCouponDraft] = useState("");
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [reply, setReply] = useState<{
    key: string;
    quote?: Quote;
    error?: string;
  }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestKey = useRef<{ fingerprint: string; key: string }>(null);
  const date = initial.date;
  const customer = role === "CUSTOMER";
  const url = (day: string) =>
    `/api/pitches/${pitch.id}/availability?date=${day}&past=1`;
  const refresh = () =>
    venueRequest<Availability>(url(date))
      .then(setAvailability)
      .catch(() => {});
  const nextDay = dayOffset(date, 1);
  useEffect(() => {
    const endpoint = (day: string) =>
      `/api/pitches/${pitch.id}/availability?date=${day}&past=1`;
    let active = true;
    async function load() {
      try {
        const current = await venueRequest<Availability>(endpoint(date));
        if (!active) return;
        setAvailability(current);
        if (nextDay <= current.maxDate) {
          const overnight = await venueRequest<Availability>(endpoint(nextDay));
          let boundary = current.slots.at(-1)?.endAt;
          const contiguous: Slot[] = [];
          for (const slot of overnight.slots) {
            if (!boundary || +new Date(slot.startAt) !== +new Date(boundary))
              break;
            contiguous.push(slot);
            boundary = slot.endAt;
          }
          if (active) setFollowing(contiguous);
        }
      } catch {
        /* last successful view remains visible */
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pitch.id, date, nextDay]);

  const all = useMemo(
    () => [...availability.slots, ...following],
    [availability.slots, following],
  );
  const selected = all.filter(
    (slot) =>
      ids.includes(slot.id) &&
      slot.status === "AVAILABLE" &&
      +new Date(slot.startAt) > availability.checkedAt,
  );
  const duration = selected.length * pitch.slotDurationMinutes;
  const request = useMemo(
    () => ({
      pitchId: pitch.id,
      slotIds: ids,
      ...(coupon ? { couponCode: coupon } : {}),
      addons: Object.entries(extras)
        .filter(([, quantity]) => quantity > 0)
        .map(([addonId, quantity]) => ({ addonId, quantity })),
    }),
    [pitch.id, ids, extras, coupon],
  );
  const key = JSON.stringify(request);
  const canQuote =
    customer &&
    ids.length === selected.length &&
    duration >= pitch.minimumBookingMinutes;
  useEffect(() => {
    if (!canQuote) return;
    let active = true;
    const timer = setTimeout(() => {
      void venueRequest<{ quote: Quote }>(
        "/api/bookings/quote",
        "POST",
        request,
      )
        .then(({ quote }) => {
          if (active) setReply({ key, quote });
        })
        .catch((error) => {
          if (active) setReply({ key, error: error.message });
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [canQuote, key, request]);

  const quote = reply?.key === key ? reply.quote : undefined;
  const dayHref = (day: string, pitchId = pitch.id) =>
    `/turfs/${slug}?pitch=${pitchId}&date=${day}`;
  const days = Array.from({ length: 7 }, (_, index) =>
    dayOffset(date < availability.today ? availability.today : date, index),
  ).filter((day) => day <= availability.maxDate);
  function toggle(slot: Slot) {
    setError("");
    if (ids.includes(slot.id)) {
      const index = selected.findIndex((item) => item.id === slot.id);
      if (index > 0 && index < selected.length - 1) {
        setError(
          "Remove a slot from either end to keep your selection consecutive.",
        );
        return;
      }
      setIds(
        selected.filter((item) => item.id !== slot.id).map((item) => item.id),
      );
      return;
    }
    const pending = [...selected, slot].sort(
      (a, b) => +new Date(a.startAt) - +new Date(b.startAt),
    );
    if (
      pending.some(
        (item, index) =>
          index > 0 &&
          +new Date(item.startAt) !== +new Date(pending[index - 1].endAt),
      )
    ) {
      setError("Choose slots next to each other.");
      return;
    }
    if (
      pending.length * pitch.slotDurationMinutes >
      pitch.maximumBookingMinutes
    ) {
      setError(`Choose up to ${pitch.maximumBookingMinutes} minutes.`);
      return;
    }
    setIds(pending.map((item) => item.id));
  }
  const zone = availability.timezone;
  const groups = [
    {
      label: "Morning",
      slots: availability.slots.filter(
        (slot) => hourOf(slot.startAt, zone) < 12,
      ),
    },
    {
      label: "Afternoon",
      slots: availability.slots.filter(
        (slot) =>
          hourOf(slot.startAt, zone) >= 12 && hourOf(slot.startAt, zone) < 17,
      ),
    },
    {
      label: "Evening",
      slots: availability.slots.filter(
        (slot) => hourOf(slot.startAt, zone) >= 17,
      ),
    },
    { label: "Following day", slots: following },
  ];
  return (
    <aside className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5 lg:sticky lg:top-4">
      <h2 className="text-2xl font-extrabold">Pitch availability</h2>
      <p className="mt-1 text-sm text-muted">
        From{" "}
        <strong className="text-foreground">{money(pitch.basePrice)}</strong> /
        hour · {zone}
      </p>
      <nav aria-label="Pitches" className="my-4 flex gap-2 overflow-auto pb-1">
        {pitches.map((item) => (
          <Button
            asChild
            variant={item.id === pitch.id ? "default" : "outline"}
            className="shrink-0"
            key={item.id}
          >
            <Link
              aria-current={item.id === pitch.id ? "page" : undefined}
              href={dayHref(date, item.id)}
              scroll={false}
            >
              {item.name}
            </Link>
          </Button>
        ))}
      </nav>
      <nav aria-label="Booking dates" className="flex gap-2 overflow-auto pb-1">
        {days.map((day) => (
          <Button
            key={day}
            asChild
            variant={day === date ? "default" : "outline"}
            className="shrink-0"
          >
            <Link
              aria-current={day === date ? "date" : undefined}
              href={dayHref(day)}
              scroll={false}
            >
              {labelDay(day)}
            </Link>
          </Button>
        ))}
      </nav>
      <label className="mt-3 grid gap-1 text-sm font-bold">
        <span className="flex items-center gap-2">
          <CalendarDays size={16} aria-hidden /> Availability date
        </span>
        <Input
          type="date"
          value={date}
          min={availability.today}
          max={availability.maxDate}
          onChange={(e) => {
            if (e.target.value)
              router.replace(dayHref(e.target.value), { scroll: false });
          }}
        />
      </label>
      <div className="my-4 max-h-[23rem] space-y-4 overflow-auto pr-1">
        {groups.map(
          (group) =>
            group.slots.length > 0 && (
              <section key={group.label}>
                <h3 className="mb-2 text-sm font-extrabold">{group.label}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {group.slots.map((slot) => {
                    const isPast =
                      +new Date(slot.startAt) <= availability.checkedAt;
                    const active = selected.some((item) => item.id === slot.id);
                    const state = isPast
                      ? "Past"
                      : active
                        ? "Selected"
                        : slot.status === "HELD"
                          ? "Held"
                          : slotLabel[slot.status];
                    const label = `${slotTime(slot.startAt, zone)} to ${slotTime(slot.endAt, zone)}`;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={
                          isPast ||
                          slot.status !== "AVAILABLE" ||
                          Boolean(role && !customer) ||
                          busy
                        }
                        aria-pressed={active}
                        aria-label={`${label}, ${state}, ${money(slot.price)}`}
                        onClick={() => toggle(slot)}
                        className={`min-h-16 rounded-xl border p-2 text-left text-xs disabled:cursor-default ${active ? "border-brand-dot bg-highlight" : "border-border bg-background enabled:hover:border-brand-dot"}`}
                      >
                        <span className="block font-bold">
                          {slotTime(slot.startAt, zone)} –{" "}
                          {slotTime(slot.endAt, zone)}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge
                            tone={
                              active || state === "Available"
                                ? "green"
                                : slot.status === "BLOCKED"
                                  ? "amber"
                                  : "neutral"
                            }
                          >
                            {state}
                          </Badge>
                          {(active || state === "Available") && (
                            <strong>{money(slot.price)}</strong>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ),
        )}
        {!all.length && (
          <p className="rounded-xl bg-background p-4 text-sm text-muted">
            No slots for this date. Try another date or pitch.
          </p>
        )}
      </div>
      {!!selected.length && addons.length > 0 && (
        <fieldset className="mb-4 grid gap-2">
          <legend className="mb-2 font-extrabold">
            Equipment and services
          </legend>
          {addons.map((item) => (
            <label
              key={item.id}
              className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border p-2 text-sm"
            >
              <span>
                <strong>{item.name}</strong>
                <span className="block text-xs text-muted">
                  {money(item.price)} · {human(item.pricingType)}
                  {item.description ? ` · ${item.description}` : ""}
                </span>
              </span>
              {item.pricingType === "PER_QUANTITY" ? (
                <Input
                  aria-label={`Quantity for ${item.name}`}
                  type="number"
                  min={0}
                  max={20}
                  className="w-17"
                  value={extras[item.id] ?? 0}
                  onChange={(e) =>
                    setExtras((value) => ({
                      ...value,
                      [item.id]: Math.max(
                        0,
                        Math.min(20, Number(e.target.value)),
                      ),
                    }))
                  }
                />
              ) : (
                <input
                  type="checkbox"
                  aria-label={`Add ${item.name}`}
                  checked={Boolean(extras[item.id])}
                  onChange={(e) =>
                    setExtras((value) => ({
                      ...value,
                      [item.id]: e.target.checked ? 1 : 0,
                    }))
                  }
                />
              )}
            </label>
          ))}
        </fieldset>
      )}
      {!!selected.length && (
        <div className="mb-4 border-t border-border pt-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Clock size={16} aria-hidden /> {duration} minutes selected{" "}
            <button
              type="button"
              className="ml-auto text-brand-dot underline"
              onClick={() => setIds([])}
            >
              Clear selection
            </button>
          </p>
          {customer && ids.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm font-semibold">
                Coupon code
                <input
                  value={couponDraft}
                  maxLength={30}
                  onChange={(event) =>
                    setCouponDraft(event.target.value.toUpperCase())
                  }
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCoupon(couponDraft.trim())}
              >
                Apply code
              </Button>
              {coupon && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCoupon("");
                    setCouponDraft("");
                  }}
                >
                  Remove code
                </Button>
              )}
            </div>
          )}
          {quote ? (
            <PriceSummary price={quote} />
          ) : (
            <p className="text-sm text-muted">
              Slot subtotal{" "}
              {money(selected.reduce((sum, slot) => sum + slot.price, 0))} ·{" "}
              {customer && duration < pitch.minimumBookingMinutes
                ? `Minimum ${pitch.minimumBookingMinutes} minutes`
                : "Final price shown before you reserve"}
            </p>
          )}
        </div>
      )}
      {(error || (reply?.key === key && reply.error)) && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
        >
          {error || reply?.error}
        </p>
      )}
      {(!role || customer) && (
        <Button
          className="w-full"
          disabled={
            busy ||
            !selected.length ||
            (customer && (!quote || ids.length !== selected.length))
          }
          onClick={async () => {
            if (!role) {
              router.push(`/login?next=${encodeURIComponent(dayHref(date))}`);
              return;
            }
            if (!quote) return;
            setBusy(true);
            setError("");
            const idempotency =
              requestKey.current?.fingerprint === quote.fingerprint
                ? requestKey.current.key
                : crypto.randomUUID();
            requestKey.current = {
              fingerprint: quote.fingerprint,
              key: idempotency,
            };
            try {
              const { booking } = await venueRequest<{
                booking: { id: string };
              }>(
                "/api/bookings",
                "POST",
                { ...request, quoteFingerprint: quote.fingerprint },
                { "Idempotency-Key": idempotency },
              );
              router.push(`/checkout/${booking.id}`);
            } catch (problem) {
              setError(
                problem instanceof Error
                  ? problem.message
                  : "Could not reserve your slots.",
              );
              if (
                problem instanceof VenueRequestError &&
                problem.status === 409
              ) {
                await refresh();
                if (problem.code === "PRICE_CHANGED") {
                  try {
                    setReply({
                      key,
                      quote: (
                        await venueRequest<{ quote: Quote }>(
                          "/api/bookings/quote",
                          "POST",
                          request,
                        )
                      ).quote,
                    });
                  } catch {
                    setIds([]);
                  }
                } else if (problem.code === "SLOTS_UNAVAILABLE") setIds([]);
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <LockKeyhole size={16} aria-hidden />
          {busy
            ? "Reserving…"
            : role
              ? "Continue to checkout"
              : "Log in to continue"}
        </Button>
      )}
    </aside>
  );
}
