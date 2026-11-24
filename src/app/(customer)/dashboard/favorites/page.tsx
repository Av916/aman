import Link from "next/link";
import { Heart } from "lucide-react";
import { Dashboard } from "@/components/layouts/dashboard";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { VenueCard } from "@/components/venues/venue-card";
import { Pagination } from "@/components/venues/pagination";
import { requireDashboardRole } from "@/lib/auth";
import { listFavorites } from "@/modules/favorites/service";

export const metadata = { title: "Favorites" };
export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireDashboardRole("CUSTOMER");
  const raw = Number((await searchParams).page ?? 1);
  const page = Number.isInteger(raw) && raw >= 1 && raw <= 1000 ? raw : 1;
  const { venues, pagination } = await listFavorites(user.id, page);
  return (
    <Dashboard
      role="CUSTOMER"
      section="favorites"
      pageDescription="Return to saved venues and check their latest availability."
      content={
        <div className="grid gap-5">
          {venues.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {venues.map((venue) => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  role="CUSTOMER"
                  saved
                  favoritesPage
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No saved venues"
              description="Save a ground while exploring to find it here again."
              icon={Heart}
            />
          )}
          <Pagination
            href="/dashboard/favorites"
            params=""
            page={page}
            pages={pagination.pages}
          />
          <div>
            <Button asChild variant="outline">
              <Link href="/turfs">Explore turfs</Link>
            </Button>
          </div>
        </div>
      }
    />
  );
}
