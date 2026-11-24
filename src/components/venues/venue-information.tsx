import { MapPin, Users } from "lucide-react";
import { VenueGallery } from "./gallery";
import { VenueMap } from "./venue-map";
import { human, money } from "./format";
import type { ManagedVenue, PublicVenue } from "@/modules/venues/venue.types";
import { minutesToClock } from "@/modules/schedules/time";

export const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function VenueInformation({
  venue,
  heading = "About this venue",
  showGallery = true,
}: {
  venue: PublicVenue | ManagedVenue;
  heading?: string;
  showGallery?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-8">
      {showGallery && <VenueGallery images={venue.images} />}
      <section className="space-y-3">
        <h2 className="text-2xl font-extrabold">{heading}</h2>
        <p className="whitespace-pre-line text-muted">
          {venue.description || "A description will appear here."}
        </p>
        <p className="flex gap-2 text-sm text-muted">
          <MapPin size={18} className="shrink-0 text-brand-dot" aria-hidden />
          {[
            venue.address,
            venue.locality,
            venue.city,
            venue.state,
            venue.postalCode,
            venue.country,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
      </section>
      <section>
        <h2 className="mb-4 text-2xl font-extrabold">Cricket pitches</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {venue.pitches.map((pitch) => (
            <li
              key={pitch.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <h3 className="font-extrabold">{pitch.name}</h3>
              <p className="mt-1 text-sm text-muted">
                {human(pitch.pitchType)} · {human(pitch.surfaceType)} ·{" "}
                {pitch.isIndoor ? "Indoor" : "Outdoor"}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <Users size={16} aria-hidden />
                {pitch.capacity} players · {pitch.lengthInMeters} ×{" "}
                {pitch.widthInMeters} m
              </p>
              <p className="mt-1 text-sm font-bold">
                {money(pitch.basePrice)} / hour
              </p>
              {pitch.description && (
                <p className="mt-2 text-sm text-muted">{pitch.description}</p>
              )}
              <details className="mt-3 border-t border-border pt-2 text-sm">
                <summary className="cursor-pointer py-2 font-bold">
                  Weekly operating hours
                </summary>
                {pitch.hours.length ? (
                  <ul className="space-y-1 text-muted">
                    {pitch.hours.map((row, index) => (
                      <li key={index}>
                        {weekdays[row.dayOfWeek]} ·{" "}
                        {row.isClosed ||
                        row.openingTime === null ||
                        row.closingTime === null
                          ? "Closed"
                          : `${minutesToClock(row.openingTime)}–${minutesToClock(row.closingTime)}${row.closingTime < row.openingTime ? " next day" : ""}`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">Hours pending.</p>
                )}
              </details>
            </li>
          ))}
        </ul>
      </section>
      {venue.amenities.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-extrabold">Facilities</h2>
          <ul className="flex flex-wrap gap-2">
            {venue.amenities.map(({ amenity }) => (
              <li
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                key={amenity.slug}
              >
                {amenity.name}
              </li>
            ))}
          </ul>
        </section>
      )}
      {venue.latitude !== null && venue.longitude !== null && (
        <section>
          <h2 className="mb-3 text-2xl font-extrabold">Location</h2>
          <VenueMap
            points={[
              {
                latitude: venue.latitude,
                longitude: venue.longitude,
                name: venue.name,
              },
            ]}
          />
        </section>
      )}
      {(venue.contactPhone || venue.contactEmail) && (
        <section>
          <h2 className="mb-3 text-2xl font-extrabold">Venue contact</h2>
          <div className="flex flex-wrap gap-4 text-sm font-bold text-brand-dot">
            {venue.contactPhone && (
              <a
                className="underline"
                href={`tel:${venue.contactPhone.replace(/[^+\d]/g, "")}`}
              >
                {venue.contactPhone}
              </a>
            )}
            {venue.contactEmail && (
              <a
                className="break-all underline"
                href={`mailto:${encodeURIComponent(venue.contactEmail)}`}
              >
                {venue.contactEmail}
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
