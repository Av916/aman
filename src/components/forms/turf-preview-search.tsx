"use client";
import { useState } from "react";
import { CalendarDays, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TurfPreviewSearch() {
  const [message, setMessage] = useState("");
  return (
    <form
      className="grid gap-3 rounded-2xl border border-border bg-surface p-3 shadow-xl sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:p-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(
          "Live search opens in Phase 2. Explore the sample turfs below.",
        );
        document.getElementById("turfs")?.scrollIntoView({ block: "start" });
      }}
    >
      <label
        htmlFor="preview-location"
        className="flex min-w-0 items-center gap-3 rounded-xl bg-background px-4 py-2.5"
      >
        <MapPin
          className="shrink-0 text-brand-dot"
          size={20}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Location</span>
          <select
            id="preview-location"
            className="h-8 w-full rounded bg-background text-sm text-muted"
          >
            <option value="">Choose a city</option>
            <option>Bengaluru</option>
            <option>Hyderabad</option>
            <option>Pune</option>
          </select>
        </span>
      </label>
      <label
        htmlFor="preview-date"
        className="flex min-w-0 items-center gap-3 rounded-xl bg-background px-4 py-2.5"
      >
        <CalendarDays
          className="shrink-0 text-brand-dot"
          size={20}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Play date</span>
          <input
            type="date"
            id="preview-date"
            className="block h-8 w-full min-w-0 rounded bg-background text-sm text-muted"
          />
        </span>
      </label>
      <Button type="submit" size="lg" className="min-h-14">
        <Search size={18} aria-hidden="true" /> Preview search
      </Button>
      <p role="status" className="text-sm text-muted sm:col-span-full">
        {message ||
          "Demo search · Live availability and booking open in Phase 2."}
      </p>
    </form>
  );
}
