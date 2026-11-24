"use client";

import { useReportWebVitals } from "next/web-vitals";

function report(metric: { name: string; value: number }) {
  if (process.env.NODE_ENV !== "production" || metric.name === "FID") return;
  navigator.sendBeacon(
    "/api/telemetry",
    new Blob(
      [
        JSON.stringify({
          event: "web_vital",
          name: metric.name,
          value: metric.value,
        }),
      ],
      { type: "application/json" },
    ),
  );
}
export function WebVitals() {
  useReportWebVitals(report);
  return null;
}
