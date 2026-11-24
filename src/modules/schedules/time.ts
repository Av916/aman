import { TZDate, tz } from "@date-fns/tz";
import { addMinutes, format } from "date-fns";

export const DAY_MINUTES = 1440;
export const dayString = (value: Date) => value.toISOString().slice(0, 10);
export const civilDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
export const shiftDay = (day: string, offset: number) =>
  dayString(addMinutes(civilDate(day), offset * DAY_MINUTES));
export const dayOfWeek = (day: string) => civilDate(day).getUTCDay();

export function atVenueTime(day: string, minute: number, zone: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(+new TZDate(year, month - 1, date, 0, minute, zone));
}

export function localDay(value: Date, zone: string) {
  return format(value, "yyyy-MM-dd", { in: tz(zone) });
}
export function localMinute(value: Date, zone: string) {
  const local = new TZDate(+value, zone);
  return local.getHours() * 60 + local.getMinutes();
}
export function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return /^[A-Za-z][A-Za-z0-9_+/-]*$/.test(value);
  } catch {
    return false;
  }
}
export function minutesToClock(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
