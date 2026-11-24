import { getEnv } from "@/lib/env";
import Link from "next/link";
import { headers } from "next/headers";
import { List, Map } from "lucide-react";
import { PublicNav } from "@/components/layouts/public-nav";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { DiscoveryControls } from "@/components/venues/search-controls";
import { VenueCard } from "@/components/venues/venue-card";
import { VenueMap } from "@/components/venues/venue-map";
import { Pagination } from "@/components/venues/pagination";
import { listAmenities } from "@/modules/amenities/service";
import { listCities } from "@/modules/venues/public-http";
import { discoverVenues } from "@/modules/venues/venue.repository";
import { discoveryQuery } from "@/modules/venues/venue.validation";
import { throttleDiscovery } from "@/modules/venues/http";
import { AppError } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { savedVenueIds } from "@/modules/favorites/service";

export function generateMetadata() {
  const url = new URL("/turfs", getEnv().APP_URL).href;
  return {
    title: "Explore cricket turfs",
    description:
      "Explore published cricket venues and check live pitch availability.",
    alternates: { canonical: url },
    openGraph: { url },
  };
}

export default async function TurfSearch({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = Object.fromEntries(
    Object.entries(await searchParams).flatMap(([key, value]) =>
      typeof value === "string" && value !== "" ? [[key, value]] : [],
    ),
  );
  const validation = discoveryQuery.safeParse(raw);
  const filters = validation.success
    ? validation.data
    : discoveryQuery.parse({});
  const params = new URLSearchParams(validation.success ? raw : {});
  const mapView = params.get("view") === "map";
  const alternate = new URLSearchParams(params);
  if (mapView) alternate.delete("view");
  else alternate.set("view", "map");
  let limited = false;
  try {
    await throttleDiscovery(await headers());
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== 429) throw error;
    limited = true;
  }

  const [results, cities, amenities, user] = limited
    ? ([
        { venues: [], pagination: { total: 0, pages: 0 } },
        [],
        [],
        null,
      ] as const)
    : await Promise.all([
        discoverVenues(filters),
        listCities(),
        listAmenities(),
        currentUser(),
      ]);
  const saved =
    user?.role === "CUSTOMER"
      ? await savedVenueIds(
          user.id,
          results.venues.map((venue) => venue.id),
        )
      : [];
  const mapPoints = results.venues.flatMap(
    ({ latitude, longitude, name, slug }) =>
      latitude === null || longitude === null
        ? []
        : [{ latitude, longitude, name, href: `/turfs/${slug}` }],
  );
  const active = [
    filters.city,
    filters.locality,
    filters.pitchType?.replaceAll("_", " "),
    filters.date,
    ...filters.amenities,
  ].filter(Boolean);

  return (
    <>
      <PublicNav />
      <main
        id="main-content"
        className="mx-auto max-w-[83rem] px-4 py-8 sm:px-8 sm:py-12"
      >
        <header className="mb-7">
          <h1 className="text-4xl font-extrabold tracking-[-.06em] sm:text-6xl">
            Explore cricket turfs
          </h1>
          <p className="mt-3 text-muted">
            Compare pitches, check schedules and save your favorite grounds.
          </p>
        </header>
        {!validation.success && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-border bg-surface p-3 text-sm text-destructive"
          >
            {validation.error.issues[0].message} Showing unfiltered results.
          </p>
        )}
        {limited ? (
          <EmptyState
            title="Search is temporarily limited"
            description="Please try again in a few minutes."
          />
        ) : (
          <DiscoveryControls
            key={params.toString().replace(/(^|&)q=[^&]*/g, "")}
            params={params.toString()}
            filters={filters}
            cities={cities}
            amenities={amenities}
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="font-bold">
                {results.pagination.total}{" "}
                {results.pagination.total === 1 ? "venue" : "venues"}
              </p>
              <div className="flex flex-wrap gap-2">
                {active.length > 0 && (
                  <Button asChild variant="ghost">
                    <Link href="/turfs">Clear filters</Link>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href={`/turfs?${alternate}`}>
                    {mapView ? (
                      <List size={17} aria-hidden />
                    ) : (
                      <Map size={17} aria-hidden />
                    )}
                    {mapView ? "List view" : "Map view"}
                  </Link>
                </Button>
              </div>
            </div>
            {active.length > 0 && (
              <p
                className="mb-4 flex gap-2 overflow-x-auto pb-1 text-xs text-muted sm:flex-wrap"
                aria-label="Active filters"
              >
                {active.map((filter, i) => (
                  <span
                    key={i}
                    className="shrink-0 rounded-full bg-highlight px-3 py-1 font-bold"
                  >
                    {filter}
                  </span>
                ))}
              </p>
            )}
            {mapView && mapPoints.length > 0 && (
              <div className="mb-5">
                <VenueMap points={mapPoints} />
              </div>
            )}
            {results.venues.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.venues.map((venue) => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    role={user?.role}
                    saved={saved.includes(venue.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No matching venues"
                description="Try another city or clear a filter to see more grounds."
              />
            )}
            <Pagination
              href="/turfs"
              params={params.toString()}
              page={filters.page}
              pages={results.pagination.pages}
            />
          </DiscoveryControls>
        )}
      </main>
    </>
  );
}
