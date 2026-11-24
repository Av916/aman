"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { panelClass } from "./shared";

export function LedgerCharts({
  income,
  occupancy,
  weekly,
  monthly,
  pitchAmounts,
}: {
  income: { day: string; collected: number; refunds: number }[];
  occupancy: { name: string; rate: number }[];
  weekly: {
    day: string;
    bookings: number;
    cancelled: number;
    noShow: number;
  }[];
  monthly: { month: string; net: number }[];
  pitchAmounts: { name: string; net: number }[];
}) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <section
        className={panelClass}
        aria-label="Daily collections and refunds in rupees"
      >
        <h3 className="mb-4 font-bold">Cash flow by day</h3>
        <p className="mb-2 text-sm text-muted">
          Collections and refunds in INR
        </p>
        {income.length ? (
          <div className="h-60">
            <ResponsiveContainer>
              <LineChart data={income} margin={{ right: 16 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(value: string) => value.slice(5)}
                />
                <YAxis width={65} />
                <Tooltip />
                <Line
                  dataKey="collected"
                  name="Collected"
                  stroke="#16845b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="refunds"
                  name="Refunds"
                  stroke="#bd525a"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No recorded cash flow in this period.
          </p>
        )}
      </section>
      <section
        className={panelClass}
        aria-label="Sellable time occupancy by pitch"
      >
        <h3 className="mb-4 font-bold">Pitch occupancy</h3>
        {occupancy.length ? (
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={occupancy} margin={{ right: 16 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip />
                <Bar
                  dataKey="rate"
                  name="Occupancy %"
                  fill="#16845b"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No eligible inventory in this period.
          </p>
        )}
      </section>
      <section
        className={panelClass}
        aria-label="Bookings and operational exceptions by week"
      >
        <h3 className="mb-4 font-bold">Weekly bookings</h3>
        {weekly.length ? (
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={weekly}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(item: string) => item.slice(5)}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="bookings"
                  name="Bookings"
                  fill="#16845b"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="cancelled"
                  name="Cancelled"
                  fill="#bb4e57"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="noShow"
                  name="No-show"
                  fill="#c17b25"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted">No bookings in this period.</p>
        )}
      </section>
      <section
        className={panelClass}
        aria-label="Monthly net collections in rupees"
      >
        <h3 className="mb-4 font-bold">Monthly net collections</h3>
        {monthly.length ? (
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis width={65} />
                <Tooltip />
                <Bar
                  dataKey="net"
                  name="Net collected in INR"
                  fill="#16845b"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted">No collections in this period.</p>
        )}
      </section>
      <section
        className={panelClass}
        aria-label="Net collection comparison by pitch"
      >
        <h3 className="mb-4 font-bold">Net collected by pitch</h3>
        {pitchAmounts.length ? (
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={pitchAmounts}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis width={65} />
                <Tooltip />
                <Bar
                  dataKey="net"
                  name="Net collected in INR"
                  fill="#16845b"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No pitch collections in this period.
          </p>
        )}
      </section>
    </div>
  );
}
