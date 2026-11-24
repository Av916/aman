import type {
  OperatingHours,
  Pitch,
  PricingRule,
  ScheduleException,
} from "@/generated/prisma/client";
import {
  atVenueTime,
  DAY_MINUTES,
  dayOfWeek,
  dayString,
  localDay,
  localMinute,
  shiftDay,
} from "@/modules/schedules/time";
import { intervalSpan } from "@/modules/schedules/validation";
import { priceForMinutes, priceResolver } from "@/modules/pricing/resolve";

type Inputs = {
  pitch: Pick<Pitch, "basePrice" | "slotDurationMinutes" | "isActive">;
  hours: Pick<
    OperatingHours,
    "dayOfWeek" | "openingTime" | "closingTime" | "isClosed"
  >[];
  exceptions: Pick<
    ScheduleException,
    "date" | "openingTime" | "closingTime" | "isClosed"
  >[];
  rules: PricingRule[];
  timezone: string;
  startDay: string;
  days: number;
  now: Date;
  currency: string;
};

export function generateSlots({
  pitch,
  hours,
  exceptions,
  rules,
  timezone,
  startDay,
  days,
  now,
  currency,
}: Inputs) {
  const slots: {
    startAt: Date;
    endAt: Date;
    price: number;
    hourlyPrice: number;
    currency: string;
  }[] = [];
  if (!pitch.isActive) return slots;
  const lastDay = shiftDay(startDay, days);
  const lower = Math.max(+now, +atVenueTime(startDay, 0, timezone));
  const upper = +atVenueTime(lastDay, 0, timezone);
  const overrides = new Map(
    exceptions.map((exception) => [dayString(exception.date), exception]),
  );
  const rate = priceResolver(pitch.basePrice, rules);
  const duration = pitch.slotDurationMinutes * 60_000;

  for (
    let day = shiftDay(startDay, -1);
    day < lastDay;
    day = shiftDay(day, 1)
  ) {
    const exception = overrides.get(day);
    const nextDay = shiftDay(day, 1);
    const rows = exception
      ? [exception]
      : hours.filter((row) => row.dayOfWeek === dayOfWeek(day));
    const ownOpening = (target: string) => {
      const override = overrides.get(target);
      return override
        ? 0
        : Math.min(
            DAY_MINUTES,
            ...hours
              .filter((row) => row.dayOfWeek === dayOfWeek(target))
              .flatMap((row) => {
                const span = intervalSpan(row);
                return span ? [span.start] : [];
              }),
          );
    };
    const spans = rows
      .flatMap((row) => {
        const span = intervalSpan(row);
        return span ? [span] : [];
      })
      .sort((a, b) => a.start - b.start);
    for (const span of spans) {
      // The next civil date's exception replaces incoming overnight hours. Ordinary
      // hours also cap an exception's spill before the first regular opening.
      const stop =
        span.end > DAY_MINUTES
          ? Math.min(span.end, DAY_MINUTES + ownOpening(nextDay))
          : span.end;
      const from = +atVenueTime(day, span.start, timezone);
      const end = +atVenueTime(day, stop, timezone);
      for (
        let start = from;
        start + duration <= end && start < upper;
        start += duration
      ) {
        if (start < lower) continue;
        const last = slots.at(-1);
        if (last && +last.endAt > start) continue;
        const startAt = new Date(start);
        const hourlyPrice = rate(
          localDay(startAt, timezone),
          localMinute(startAt, timezone),
        );
        slots.push({
          startAt,
          endAt: new Date(start + duration),
          hourlyPrice,
          price: priceForMinutes(hourlyPrice, pitch.slotDurationMinutes),
          currency,
        });
      }
    }
  }
  return slots;
}
