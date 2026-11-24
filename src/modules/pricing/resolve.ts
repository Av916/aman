import type { PricingRule } from "@/generated/prisma/client";
import {
  DAY_MINUTES,
  dayOfWeek,
  dayString,
  shiftDay,
} from "@/modules/schedules/time";

type Rule = Pick<
  PricingRule,
  | "ruleType"
  | "daysOfWeek"
  | "startTime"
  | "endTime"
  | "pricePerHour"
  | "effectiveFrom"
  | "effectiveUntil"
  | "priority"
  | "isActive"
>;

type Band = {
  start: number;
  end: number;
  days: number[];
  from: string;
  until: string;
};
function bands(rule: Rule): Band[] {
  const days = rule.daysOfWeek.length
    ? rule.daysOfWeek
    : rule.ruleType === "WEEKDAY"
      ? [1, 2, 3, 4, 5]
      : rule.ruleType === "WEEKEND"
        ? [0, 6]
        : [0, 1, 2, 3, 4, 5, 6];
  const start = rule.startTime ?? 0;
  const end = rule.endTime ?? DAY_MINUTES;
  const from = rule.effectiveFrom
    ? dayString(rule.effectiveFrom)
    : "0001-01-01";
  const until = rule.effectiveUntil
    ? dayString(rule.effectiveUntil)
    : "9999-12-30";
  if (end > start) return [{ start, end, days, from, until }];
  return [
    { start, end: DAY_MINUTES, days, from, until },
    ...(end === 0
      ? []
      : [
          {
            start: 0,
            end,
            days: days.map((day) => (day + 1) % 7),
            from: shiftDay(from, 1),
            until: shiftDay(until, 1),
          },
        ]),
  ];
}

export function ambiguousRules(a: Rule, b: Rule) {
  if (!a.isActive || !b.isActive || a.priority !== b.priority) return false;
  return bands(a).some((x) =>
    bands(b).some((y) => {
      if (x.start >= y.end || y.start >= x.end) return false;
      const from = x.from > y.from ? x.from : y.from;
      const until = x.until < y.until ? x.until : y.until;
      return x.days.some(
        (day) =>
          y.days.includes(day) &&
          shiftDay(from, (day - dayOfWeek(from) + 7) % 7) <= until,
      );
    }),
  );
}

export function priceResolver(basePrice: number, rules: Rule[]) {
  const active = rules
    .filter((rule) => rule.isActive)
    .sort((a, b) => b.priority - a.priority)
    .map((rule) => ({ price: rule.pricePerHour, bands: bands(rule) }));
  return (day: string, minute: number) =>
    active.find((rule) =>
      rule.bands.some(
        (band) =>
          day >= band.from &&
          day <= band.until &&
          band.days.includes(dayOfWeek(day)) &&
          minute >= band.start &&
          minute < band.end,
      ),
    )?.price ?? basePrice;
}

export function priceForMinutes(hourlyPrice: number, minutes: number) {
  return Math.floor((hourlyPrice * minutes + 30) / 60);
}
