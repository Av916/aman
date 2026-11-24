import Link from "next/link";
import { notFound } from "next/navigation";
import { Dashboard } from "@/components/layouts/dashboard";
import { VenueInformation } from "@/components/venues/venue-information";
import { ReviewActions } from "@/components/venues/review-actions";
import { human } from "@/components/venues/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireDashboardRole } from "@/lib/auth";
import { AppError } from "@/lib/api";
import { venueReview } from "@/modules/admin/venue-review";
import { idSchema } from "@/modules/venues/venue.validation";

const time = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
export default async function AdminVenue({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireDashboardRole("ADMIN");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const { venue, audit } = await venueReview(id.data).catch((error) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  return (
    <Dashboard
      role="ADMIN"
      section="turfs"
      pageTitle={venue.name}
      pageDescription="Review venue information, ownership and approval history."
      content={
        <div className="grid gap-7">
          <div>
            <Button asChild variant="outline">
              <Link href="/admin/venues">Back to venues</Link>
            </Button>
          </div>
          <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-xl font-extrabold">Publication review</h2>
            <div className="flex flex-wrap gap-2">
              <Badge>{human(venue.status)}</Badge>
              {venue.publishedAt && <Badge tone="green">Published</Badge>}
            </div>
            <p className="break-words text-sm text-muted">
              {venue.owner.name} · {venue.owner.email} · Owner profile{" "}
              {human(venue.owner.ownerProfile?.verificationStatus ?? "PENDING")}
            </p>
            {venue.rejectionReason && (
              <p className="text-sm">
                Review feedback · {venue.rejectionReason}
              </p>
            )}
            <ReviewActions
              key={venue.status}
              id={venue.id}
              status={venue.status}
            />
          </section>
          <VenueInformation venue={venue} />
          <section>
            <h2 className="mb-3 text-2xl font-extrabold">
              Venue audit history
            </h2>
            {audit.length ? (
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {audit.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap justify-between gap-2 p-3 text-sm"
                  >
                    <span>
                      <strong>{human(event.action)}</strong> ·{" "}
                      {event.actor?.name ?? "System"}
                    </span>
                    <time dateTime={event.createdAt.toISOString()}>
                      {time.format(event.createdAt)} UTC
                    </time>
                    {event.metadata &&
                      typeof event.metadata === "object" &&
                      "reason" in event.metadata &&
                      typeof event.metadata.reason === "string" && (
                        <span className="w-full text-muted">
                          {event.metadata.reason}
                        </span>
                      )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No audit events yet.</p>
            )}
          </section>
        </div>
      }
    />
  );
}
