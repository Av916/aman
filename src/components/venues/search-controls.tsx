"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MapPin, Search, SlidersHorizontal } from "lucide-react";
import { PitchType, SurfaceType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { DiscoveryQuery } from "@/modules/venues/venue.validation";
import { human } from "./format";

const selectClass =
  "min-h-11 w-full rounded-xl border border-control-border bg-surface px-3 text-sm";
const sorts = {
  relevance: "Relevance",
  "price-asc": "Price low to high",
  "price-desc": "Price high to low",
  recent: "Recently added",
  name: "Name",
  distance: "Distance",
};
type Amenity = { slug: string; name: string };

function Filters({
  id,
  filters,
  amenities,
}: {
  id: string;
  filters: DiscoveryQuery;
  amenities: readonly Amenity[];
}) {
  return (
    <div className="grid gap-3 text-sm">
      <label className="grid gap-1 font-bold">
        Locality
        <Input name={`${id}locality`} defaultValue={filters.locality} />
      </label>
      <label className="grid gap-1 font-bold">
        Pitch type
        <select
          className={selectClass}
          name={`${id}pitchType`}
          defaultValue={filters.pitchType ?? ""}
        >
          <option value="">Any type</option>
          {Object.values(PitchType).map((type) => (
            <option key={type} value={type}>
              {human(type)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 font-bold">
        Surface
        <select
          className={selectClass}
          name={`${id}surfaceType`}
          defaultValue={filters.surfaceType ?? ""}
        >
          <option value="">Any surface</option>
          {Object.values(SurfaceType).map((type) => (
            <option key={type} value={type}>
              {human(type)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 font-bold">
        Setting
        <select
          className={selectClass}
          name={`${id}setting`}
          defaultValue={filters.setting ?? ""}
        >
          <option value="">Indoor or outdoor</option>
          <option value="indoor">Indoor</option>
          <option value="outdoor">Outdoor</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 font-bold">
          Min ₹/hr
          <Input
            type="number"
            min="0"
            step="0.01"
            name={`${id}minPrice`}
            defaultValue={
              filters.minPrice === undefined ? "" : filters.minPrice / 100
            }
          />
        </label>
        <label className="grid gap-1 font-bold">
          Max ₹/hr
          <Input
            type="number"
            min="0"
            step="0.01"
            name={`${id}maxPrice`}
            defaultValue={
              filters.maxPrice === undefined ? "" : filters.maxPrice / 100
            }
          />
        </label>
      </div>
      <label className="grid gap-1 font-bold">
        Player capacity
        <Input
          type="number"
          min="1"
          max="500"
          name={`${id}capacity`}
          defaultValue={filters.capacity}
        />
      </label>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        <label className="grid min-w-0 gap-1 font-bold">
          From
          <Input
            type="time"
            className="min-w-0 text-sm"
            name={`${id}from`}
            defaultValue={filters.from}
          />
        </label>
        <label className="grid gap-1 font-bold">
          Until
          <Input
            type="time"
            className="min-w-0 text-sm"
            name={`${id}until`}
            defaultValue={filters.until}
          />
        </label>
      </div>
      <fieldset className="grid gap-1">
        <legend className="mb-1 font-extrabold">Amenities</legend>
        {amenities.map((item) => (
          <label key={item.slug} className="flex min-h-9 items-center gap-2">
            <input
              type="checkbox"
              name={`${id}amenities`}
              value={item.slug}
              defaultChecked={filters.amenities.includes(item.slug)}
            />
            {item.name}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function DiscoveryControls({
  filters,
  params,
  cities,
  amenities,
  children,
}: {
  filters: DiscoveryQuery;
  params: string;
  cities: readonly { city: string }[];
  amenities: readonly Amenity[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const path = usePathname();
  const [term, setTerm] = useState(filters.q);
  const [dialog, setDialog] = useState(false);
  const [locationError, setLocationError] = useState("");
  const typed = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!typed.current || term === filters.q) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (term.trim()) next.set("q", term.trim());
      else next.delete("q");
      next.delete("page");
      router.replace(`${path}?${next}`, { scroll: false });
    }, 450);
    return () => clearTimeout(timer);
  }, [term, filters.q, params, path, router]);

  function submit(data: FormData, prefix = "") {
    const values = new URLSearchParams(params);
    for (const field of ["q", "city", "date", "sort"]) {
      const value = String(data.get(field) ?? "").trim();
      if (value) values.set(field, value);
      else values.delete(field);
    }
    for (const field of [
      "locality",
      "minPrice",
      "maxPrice",
      "pitchType",
      "surfaceType",
      "setting",
      "capacity",
      "from",
      "until",
      "amenities",
    ]) {
      const key = prefix + field;
      const raw = data.getAll(key).join(",").trim();
      if (!raw) values.delete(field);
      else
        values.set(
          field,
          field === "minPrice" || field === "maxPrice"
            ? String(Math.round(Number(raw) * 100))
            : raw,
        );
    }
    values.delete("page");
    typed.current = false;
    router.push(`${path}?${values}`);
    setDialog(false);
  }

  function useLocation() {
    if (!navigator.geolocation)
      return setLocationError("Location is unavailable on this device.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = new URLSearchParams(params);
        next.set("sort", "distance");
        next.set("lat", coords.latitude.toFixed(4));
        next.set("lng", coords.longitude.toFixed(4));
        next.delete("page");
        router.push(`${path}?${next}`);
        setLocationError("");
      },
      () =>
        setLocationError(
          "Location was unavailable or permission was declined.",
        ),
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        submit(new FormData(event.currentTarget));
      }}
    >
      <div className="mb-6 grid grid-cols-2 items-end gap-3 rounded-2xl border border-border bg-surface p-4 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <label className="col-span-2 grid min-w-0 gap-1 text-sm font-bold xl:col-span-1">
          Search venues
          <Input
            type="search"
            name="q"
            maxLength={100}
            placeholder="Name, address or pitch type"
            value={term}
            onChange={(event) => {
              typed.current = true;
              setTerm(event.target.value);
            }}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold">
          City
          <select
            className={selectClass}
            name="city"
            defaultValue={filters.city}
          >
            <option value="">All cities</option>
            {cities.map(({ city }) => (
              <option key={city}>{city}</option>
            ))}
            {filters.city &&
              !cities.some(({ city }) => city === filters.city) && (
                <option>{filters.city}</option>
              )}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold">
          Play date
          <Input
            type="date"
            name="date"
            defaultValue={filters.date}
            className="min-w-0 text-sm"
          />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold">
          Sort by
          <select
            className={selectClass}
            name="sort"
            defaultValue={filters.sort}
          >
            {Object.entries(sorts).map(([key, label]) => (
              <option
                key={key}
                value={key}
                disabled={key === "distance" && filters.lat === undefined}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="h-12">
          <Search size={16} aria-hidden /> Search
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" type="button" onClick={useLocation}>
          <MapPin size={17} aria-hidden /> Use my location
        </Button>
        {locationError && (
          <span role="status" className="text-sm text-muted">
            {locationError}
          </span>
        )}
        <div className="lg:hidden">
          <Dialog open={dialog} onOpenChange={setDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" type="button">
                <SlidersHorizontal size={16} aria-hidden /> Filters
              </Button>
            </DialogTrigger>
            <DialogContent
              title="Filter turfs"
              description="Choose pitch features and available times."
              className="max-lg:top-auto max-lg:bottom-0 max-lg:translate-y-0 max-lg:rounded-b-none"
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const values = new FormData(event.currentTarget);
                  if (formRef.current)
                    for (const key of ["q", "city", "date", "sort"])
                      values.set(
                        key,
                        String(new FormData(formRef.current).get(key) ?? ""),
                      );
                  submit(values, "mobile-");
                }}
                className="grid gap-4"
              >
                <div className="max-h-[62dvh] overflow-y-auto p-1">
                  <Filters
                    id="mobile-"
                    filters={filters}
                    amenities={amenities}
                  />
                </div>
                <Button type="submit">Apply filters</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="hidden rounded-2xl border border-border bg-surface p-4 lg:block">
          <h2 className="mb-4 text-lg font-extrabold">Filters</h2>
          <Filters id="" filters={filters} amenities={amenities} />
          <Button type="submit" className="mt-4 w-full">
            Apply filters
          </Button>
        </aside>
        <div>{children}</div>
      </div>
    </form>
  );
}
