import Link from "next/link";
import { MapPin, Trees } from "lucide-react";
import type { VenueCard as VenueCardData } from "@/modules/venues/venue.types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "./favorite-button";
import { human, money } from "./format";
import { VenuePhoto } from "./gallery";

export function VenueCard({
  venue,
  saved = false,
  role,
  favoritesPage = false,
}: {
  venue: VenueCardData;
  saved?: boolean;
  role?: string;
  favoritesPage?: boolean;
}) {
  const photo = venue.images[0];
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[1.58] bg-highlight">
        {photo ? (
          <VenuePhoto
            src={photo.imageUrl}
            alt={photo.altText}
            sizes="(max-width: 640px) 90vw, (max-width: 1100px) 44vw, 28vw"
          />
        ) : (
          <Trees
            className="absolute inset-0 m-auto size-12 text-brand-dot"
            aria-hidden
          />
        )}
        <div className="absolute top-3 right-3">
          <FavoriteButton
            id={venue.id}
            name={venue.name}
            initial={saved}
            role={role}
            refresh={favoritesPage}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{human(venue.pitchType)}</Badge>
          {venue.distanceKm !== null && (
            <span className="text-xs text-muted">
              {venue.distanceKm.toFixed(1)} km away
            </span>
          )}
        </div>
        <div>
          <h3 className="text-lg font-extrabold leading-tight">{venue.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <MapPin size={15} aria-hidden />
            {[venue.locality, venue.city].filter(Boolean).join(", ")}
          </p>
        </div>
        {venue.amenities.length > 0 && (
          <p className="text-sm text-muted">
            {venue.amenities
              .slice(0, 3)
              .map(({ amenity }) => amenity.name)
              .join(" · ")}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-sm text-muted">
            From{" "}
            <strong className="text-base text-foreground">
              {money(venue.startingPrice)}
            </strong>{" "}
            / hour
          </p>
          <Button asChild variant="outline">
            <Link href={`/turfs/${venue.slug}`}>
              {favoritesPage ? "Check availability" : "View details"}
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
