"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { analytics } from "@/modules/finance/analytics";
import type { operationVenues } from "@/modules/operations/queries";
import {
  Field,
  formatMoney,
  formatTime,
  gridClass,
  inputClass,
  LoadState,
  panelClass,
  dayAt,
  dayOffset,
  readable,
  SimpleTable,
  Status,
  useOperation,
  type Json,
} from "./shared";

const Charts = dynamic(
  () => import("./charts").then((module) => module.LedgerCharts),
  { ssr: false, loading: () => <LoadState /> },
);
export function AnalyticsWorkspace({
  venues,
}: {
  venues: Json<Awaited<ReturnType<typeof operationVenues>>>;
}) {
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const venue = venues.find((item) => item.id === venueId);
  const [parameters, setParameters] = useState("");
  const state = useOperation<Json<Awaited<ReturnType<typeof analytics>>>>(
    venueId ? `/api/owner/analytics?venueId=${venueId}&${parameters}` : "",
  );
  if (!venues.length)
    return (
      <p className={panelClass}>
        No venue financial data is available to this account.
      </p>
    );
  return (
    <div className="grid gap-5">
      <form
        className={`${panelClass} ${gridClass}`}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const local = dayAt(new Date(), venue?.timezone ?? "Asia/Kolkata");
          const preset = form.get("period");
          const from =
            preset === "today"
              ? local
              : preset === "week"
                ? dayOffset(local, -6)
                : preset === "month"
                  ? local.slice(0, 7) + "-01"
                  : preset === "last30"
                    ? dayOffset(local, -29)
                    : String(form.get("from") ?? "");
          const to = preset === "custom" ? String(form.get("to") ?? "") : local;
          const params = new URLSearchParams();
          if (from) params.set("from", from);
          if (to) params.set("to", to);
          if (form.get("pitch"))
            params.set("pitchId", String(form.get("pitch")));
          setParameters(params.toString());
        }}
      >
        <Field label="Venue">
          <select
            className={inputClass}
            value={venueId}
            onChange={(event) => {
              setVenueId(event.target.value);
              setParameters("");
            }}
          >
            {venues.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pitch">
          <select key={venueId} name="pitch" className={inputClass}>
            <option value="">All pitches</option>
            {venue?.pitches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Period">
          <select name="period" className={inputClass}>
            <option value="month">Current month</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="custom">Custom dates</option>
          </select>
        </Field>
        <Button type="submit">Apply filters</Button>
        <Field label="Custom start">
          <input className={inputClass} type="date" name="from" />
        </Field>
        <Field label="Custom end">
          <input className={inputClass} type="date" name="to" />
        </Field>
      </form>
      {!state.data ? (
        <LoadState error={state.error} />
      ) : (
        state.data.venues.map((data) => {
          const income = new Map<
            string,
            { day: string; collected: number; refunds: number }
          >();
          for (const row of data.timeline) {
            const point = income.get(row.day) ?? {
              day: row.day,
              collected: 0,
              refunds: 0,
            };
            if (
              row.type === "PAYMENT_CAPTURE" ||
              row.type === "OFFLINE_PAYMENT"
            )
              point.collected += row.amount / 100;
            if (row.type === "REFUND") point.refunds += row.amount / 100;
            income.set(row.day, point);
          }
          const weekly = new Map<
            string,
            { day: string; bookings: number; cancelled: number; noShow: number }
          >();
          for (const row of data.bookingDays) {
            const weekday =
              (new Date(row.day + "T00:00:00Z").getUTCDay() + 6) % 7;
            const day = dayOffset(row.day, -weekday);
            const point = weekly.get(day) ?? {
              day,
              bookings: 0,
              cancelled: 0,
              noShow: 0,
            };
            point.bookings += row.count;
            if (row.status === "CANCELLED") point.cancelled += row.count;
            if (row.status === "NO_SHOW") point.noShow += row.count;
            weekly.set(day, point);
          }
          const monthly = new Map<string, number>();
          for (const row of income.values()) {
            const month = row.day.slice(0, 7);
            monthly.set(
              month,
              (monthly.get(month) ?? 0) + row.collected - row.refunds,
            );
          }
          const stats = [
            ["Today's bookings", data.todayBookings],
            ["Upcoming bookings", data.upcomingBookings],
            ["Collected today", formatMoney(data.todayCollected)],
            ["Collected this month", formatMoney(data.monthCollected)],
            ["Occupancy", data.occupancy + "%"],
            ["Open slots today", data.availableSlots],
            ["Pending payments", data.pendingPayments],
            ["Pending refunds", data.pendingRefunds],
            ["Gross booking value", formatMoney(data.grossBookingValue)],
            ["Net collected", formatMoney(data.netCollected)],
            ["Pending refund amount", formatMoney(data.pendingRefundPaise)],
            ["Repeat customer rate", data.repeatCustomerRate + "%"],
            ["Outstanding offline", formatMoney(data.outstanding)],
          ] as const;
          return (
            <section key={data.id} className="grid min-w-0 gap-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {stats.map(([label, value]) => (
                  <div key={label} className={panelClass}>
                    <p className="text-sm text-muted">{label}</p>
                    <p className="mt-1 text-xl font-bold sm:text-2xl">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <Charts
                income={[...income.values()]}
                occupancy={data.pitches}
                weekly={[...weekly.values()]}
                monthly={[...monthly].map(([month, net]) => ({ month, net }))}
                pitchAmounts={data.pitchMoney.map((item) => ({
                  name: item.name,
                  net: item.amount / 100,
                }))}
              />
              <section>
                <h2 className="mb-3 text-lg font-bold">Occupancy by hour</h2>
                <SimpleTable
                  columns={["Local hour", "Weekday", "Weekend"]}
                  rows={[...new Set(data.hourly.map((row) => row.hour))]
                    .sort((a, b) => a - b)
                    .map((hour) => {
                      const measure = (weekend: boolean) => {
                        const values = data.hourly.filter(
                          (row) =>
                            row.hour === hour && row.weekday >= 6 === weekend,
                        );
                        const sell = values.reduce(
                          (acc, item) => acc + item.sell,
                          0,
                        );
                        const book = values.reduce(
                          (acc, item) => acc + item.book,
                          0,
                        );
                        const rate = sell ? Math.round((book * 100) / sell) : 0;
                        return (
                          <span
                            className="inline-flex min-w-20 justify-between gap-2 rounded-md bg-primary/10 px-2 py-1"
                            style={{
                              backgroundColor: `color-mix(in srgb, var(--primary) ${Math.min(32, 5 + rate / 4)}%, transparent)`,
                            }}
                          >
                            {rate}%{" "}
                            <span className="text-muted">
                              {book}/{sell}m
                            </span>
                          </span>
                        );
                      };
                      return [
                        String(hour).padStart(2, "0") + ":00",
                        measure(false),
                        measure(true),
                      ];
                    })}
                />
              </section>
              <section>
                <h2 className="mb-3 text-lg font-bold">Recent reservations</h2>
                <SimpleTable
                  columns={["Reference", "Pitch", "Customer", "Status"]}
                  rows={data.latest.map((row) => [
                    <Link
                      key="ref"
                      href={`/owner/bookings?ref=${row.bookingNumber}`}
                      className="underline"
                    >
                      {row.bookingNumber}
                    </Link>,
                    row.pitchName,
                    row.customerName,
                    <Status key="status" value={row.status} />,
                  ])}
                />
              </section>
              <section>
                <h2 className="mb-3 text-lg font-bold">Recent reviews</h2>
                <SimpleTable
                  columns={["Rating", "Comment"]}
                  rows={data.reviews.map((row) => [
                    `${row.rating}/5`,
                    row.comment,
                  ])}
                />
              </section>
              <section>
                <h2 className="mb-3 text-lg font-bold">
                  Today’s schedule · {data.timezone}
                </h2>
                <SimpleTable
                  columns={[
                    "Reference",
                    "Customer",
                    "Pitch",
                    "Local start",
                    "Status",
                  ]}
                  rows={data.recent.map((row) => [
                    <Link
                      key="ref"
                      href={`/owner/bookings?ref=${row.bookingNumber}`}
                      className="underline"
                    >
                      {row.bookingNumber}
                    </Link>,
                    row.customerName,
                    row.pitchName,
                    formatTime(row.startAt, data.timezone),
                    <Status key="status" value={row.status} />,
                  ])}
                />
              </section>
              <section>
                <h2 className="mb-3 text-lg font-bold">Booking mix</h2>
                <SimpleTable
                  columns={[
                    "Status",
                    "Source",
                    "Bookings",
                    "Avg. minutes",
                    "Avg. value",
                  ]}
                  rows={data.groups.map((row) => [
                    readable(row.status),
                    readable(row.bookingSource),
                    row._count,
                    Math.round(row._avg.durationMinutes ?? 0),
                    formatMoney(row._avg.totalAmount ?? 0),
                  ])}
                />
              </section>
              <section>
                <h2 className="mb-3 text-lg font-bold">Ledger totals</h2>
                <SimpleTable
                  columns={["Transaction type", "Amount"]}
                  rows={Object.entries(data.revenues).map(([type, amount]) => [
                    readable(type),
                    formatMoney(amount),
                  ])}
                />
              </section>
            </section>
          );
        })
      )}
    </div>
  );
}
