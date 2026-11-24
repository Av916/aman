import Link from "next/link";
import { Building2 } from "lucide-react";
import { VenueStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/states";
import { Pagination } from "./pagination";
import { human } from "./format";
import type { listManagedVenues } from "@/modules/venues/venue.repository";

export function OwnerUnverified() {
  return (
    <EmptyState
      title="Owner approval required"
      description="An operator must verify your owner profile before you can manage venues."
      icon={Building2}
    />
  );
}

export function ManagementList({
  list,
  admin = false,
  q,
  status,
}: {
  list: Awaited<ReturnType<typeof listManagedVenues>>;
  admin?: boolean;
  q: string;
  status?: string;
}) {
  const href = admin ? "/admin/venues" : "/owner/venues";
  const params = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
  });
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form action={href} className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm font-bold">
            Search venues
            <Input
              name="q"
              defaultValue={q}
              placeholder={admin ? "Venue or owner" : "Venue or city"}
              maxLength={100}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Status
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-12 rounded-xl border border-control-border bg-surface px-3"
            >
              <option value="">All statuses</option>
              {Object.values(VenueStatus).map((item) => (
                <option key={item} value={item}>
                  {human(item)}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" type="submit" className="h-12">
            Filter
          </Button>
        </form>
        {!admin && (
          <Button asChild>
            <Link href="/owner/venues/new">Create venue</Link>
          </Button>
        )}
      </div>
      {list.venues.length ? (
        <div className="overflow-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[39rem] text-left text-sm">
            <caption className="sr-only">
              {admin ? "Venues for admin review" : "Your venues"}
            </caption>
            <thead className="border-b border-border bg-background">
              <tr>
                <th scope="col" className="p-4">
                  Venue
                </th>
                <th scope="col" className="p-4">
                  Status
                </th>
                {admin && (
                  <th scope="col" className="p-4">
                    Owner
                  </th>
                )}
                <th scope="col" className="p-4">
                  Pitches
                </th>
                <th scope="col" className="p-4">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {list.venues.map((venue) => (
                <tr
                  key={venue.id}
                  className="border-b border-border last:border-none"
                >
                  <th scope="row" className="p-4">
                    <span className="font-extrabold">{venue.name}</span>
                    <span className="block font-normal text-muted">
                      {[venue.locality, venue.city]
                        .filter(Boolean)
                        .join(", ") || "Location pending"}
                    </span>
                  </th>
                  <td className="p-4">
                    <Badge
                      tone={
                        venue.status === "APPROVED"
                          ? "green"
                          : venue.status === "PENDING_APPROVAL"
                            ? "amber"
                            : "neutral"
                      }
                    >
                      {human(venue.status)}
                    </Badge>
                    {venue.publishedAt && (
                      <span className="block text-xs text-muted">
                        Published
                      </span>
                    )}
                  </td>
                  {admin && <td className="p-4">{venue.owner?.name}</td>}
                  <td className="p-4">{venue._count.pitches}</td>
                  <td className="p-4">
                    <Button asChild variant="outline">
                      <Link href={`${href}/${venue.id}`}>
                        {admin ? "Review venue" : "Manage venue"}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No venues found"
          description={
            admin
              ? "Submitted venue listings will appear here."
              : "Create a draft or adjust the filters."
          }
          icon={Building2}
        />
      )}
      <Pagination
        href={href}
        params={params.toString()}
        page={list.pagination.page}
        pages={list.pagination.pages}
      />
    </div>
  );
}
