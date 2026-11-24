import { z } from "zod";
import { DAY_MINUTES } from "./time";

export const minute = z.number().int().min(0).max(1439);
export const weekday = z.number().int().min(0).max(6);
const interval = {
  openingTime: minute.nullable(),
  closingTime: z.number().int().min(0).max(1440).nullable(),
  isClosed: z.boolean(),
};

export type Interval = {
  openingTime: number | null;
  closingTime: number | null;
  isClosed: boolean;
};

export function validInterval(row: Interval) {
  return row.isClosed
    ? row.openingTime === null && row.closingTime === null
    : row.openingTime !== null &&
        row.closingTime !== null &&
        row.openingTime !== row.closingTime;
}

export function intervalSpan(row: Interval) {
  if (row.isClosed || row.openingTime === null || row.closingTime === null)
    return;
  return {
    start: row.openingTime,
    end:
      row.closingTime < row.openingTime
        ? row.closingTime + DAY_MINUTES
        : row.closingTime,
  };
}

export const weeklySchedule = z
  .strictObject({
    hours: z
      .array(
        z
          .strictObject({ dayOfWeek: weekday, ...interval })
          .refine(
            validInterval,
            "Enter two distinct times, or mark the day closed.",
          ),
      )
      .max(42),
  })
  .superRefine(({ hours }, ctx) => {
    const intervals: { start: number; end: number }[] = [];
    for (let day = 0; day < 7; day++) {
      const rows = hours.filter((row) => row.dayOfWeek === day);
      if (rows.some((row) => row.isClosed) && rows.length > 1) {
        ctx.addIssue({
          code: "custom",
          path: ["hours"],
          message: "A closed day cannot have other intervals.",
        });
      }
      for (const row of rows) {
        const span = intervalSpan(row);
        if (!span) continue;
        const absolute = {
          start: day * DAY_MINUTES + span.start,
          end: day * DAY_MINUTES + span.end,
        };
        intervals.push(absolute, {
          start: absolute.start - 7 * DAY_MINUTES,
          end: absolute.end - 7 * DAY_MINUTES,
        });
      }
    }
    intervals.sort((a, b) => a.start - b.start);
    if (
      intervals.some(
        (row, index) => index > 0 && row.start < intervals[index - 1].end,
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["hours"],
        message: "Operating intervals overlap, including overnight hours.",
      });
    }
  });

export const exceptionInput = z
  .strictObject({
    ...interval,
    date: z.iso.date(),
    reason: z.string().trim().min(2).max(240),
  })
  .refine(validInterval, "Enter distinct times, or mark the date closed.");
