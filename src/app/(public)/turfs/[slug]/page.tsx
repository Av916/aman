import { VenueReviews } from "@/components/operations/public-reviews";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PublicNav } from "@/components/layouts/public-nav";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { VenueCard } from "@/components/venues/venue-card";
import { VenueGallery } from "@/components/venues/gallery";
import { VenueInformation } from "@/components/venues/venue-information";
import { FavoriteButton } from "@/components/venues/favorite-button";
import { BookingPanel } from "@/components/bookings/booking-panel";
import { venueAddons } from "@/modules/addons/service";
import { discoverVenues } from "@/modules/venues/venue.repository";
import { publicVenueView } from "@/modules/venues/public-view";
import { pitchAvailability } from "@/modules/availability/service";
import {
  publicSlug,
  discoveryQuery,
  dayQuery,
} from "@/modules/venues/venue.validation";
import { savedVenueIds } from "@/modules/favorites/service";
import { currentUser } from "@/lib/auth";
import { throttleDiscovery } from "@/modules/venues/http";
import { AppError } from "@/lib/api";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: publicSlug.safeParse(slug).success
      ? ((await publicVenueView(slug))?.name ?? "Cricket turf")
      : "Cricket turf",
  };
}

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pitch?: string; date?: string }>;
}) {
  const { slug } = await params;
  if (!publicSlug.safeParse(slug).success) notFound();
  try {
    await throttleDiscovery(await headers());
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== 429) throw error;
    return (
      <>
        <PublicNav />
        <main id="main-content" className="mx-auto max-w-4xl px-5 py-12">
          <h1 className="text-3xl font-bold">
            Venue access is temporarily limited
          </h1>
          <p className="mt-3 text-muted">Please try again in a few minutes.</p>
        </main>
      </>
    );
  }
  const [venue, user, query] = await Promise.all([
    publicVenueView(slug),
    currentUser(),
    searchParams,
  ]);
  if (!venue) notFound();
  const pitch =
    venue.pitches.find(({ id }) => id === query.pitch) ?? venue.pitches[0];
  const date = dayQuery.safeParse({ date: query.date || undefined });
  const [availability, similar, addons] = await Promise.all([
    pitch
      ? pitchAvailability(
          pitch.id,
          date.success ? date.data.date : undefined,
          true,
        ).catch((error) => {
          if (error instanceof AppError && error.status === 404) return null;
          throw error;
        })
      : null,
    discoverVenues(
      discoveryQuery.parse({ city: venue.city, sort: "recent" }),
      venue.id,
    ),
    venueAddons(venue.id).catch((error) => {
      if (error instanceof AppError && error.status === 404) return [];
      throw error;
    }),
  ]);
  const saved =
    user?.role === "CUSTOMER"
      ? await savedVenueIds(user.id, [
          venue.id,
          ...similar.venues.slice(0, 3).map((item) => item.id),
        ])
      : [];
  return (
    <>
      <PublicNav />
      <main
        id="main-content"
        className="mx-auto max-w-[80rem] px-4 py-8 sm:px-8"
      >
        <Breadcrumbs
          items={[
            { label: "Explore turfs", href: "/turfs" },
            { label: venue.name },
          ]}
        />
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-[-.06em] sm:text-6xl">
              {venue.name}
            </h1>
            <p className="mt-2 text-muted">
              {[venue.locality, venue.city, venue.state]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          <FavoriteButton
            id={venue.id}
            name={venue.name}
            role={user?.role}
            initial={saved.includes(venue.id)}
          />
        </header>
        <VenueGallery images={venue.images} />
        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(22rem,1fr)]">
          <VenueInformation venue={venue} showGallery={false} />
          {pitch && availability ? (
            <BookingPanel
              key={`${pitch.id}:${availability.date}`}
              slug={venue.slug}
              pitch={pitch}
              pitches={venue.pitches}
              initial={availability}
              addons={addons}
              role={user?.role}
            />
          ) : (
            <aside className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-2xl font-extrabold">Pitch availability</h2>
              <p className="mt-2 text-muted">
                There are no active pitches to reserve.
              </p>
            </aside>
          )}
        </div>
        {similar.venues.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-5 text-2xl font-extrabold">
              More grounds in {venue.city}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {similar.venues.slice(0, 3).map((item) => (
                <VenueCard
                  key={item.id}
                  venue={item}
                  role={user?.role}
                  saved={saved.includes(item.id)}
                />
              ))}
            </div>
            <Button asChild variant="outline" className="mt-5">
              <Link href={`/turfs?city=${encodeURIComponent(venue.city)}`}>
                Browse {venue.city}
              </Link>
            </Button>
          </section>
        )}
        <VenueReviews slug={venue.slug} canReport={Boolean(user)} />
      </main>
    </>
  );
}
