import Link from "next/link";
import { Dashboard } from "@/components/layouts/dashboard";
import { OwnerUnverified } from "@/components/venues/management-list";
import { VenueInformation } from "@/components/venues/venue-information";
import { Button } from "@/components/ui/button";
import {
  ownerPageVenue,
  ownerPageUser,
} from "@/modules/venues/management-pages";

export default async function PreviewVenue({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, approved } = await ownerPageUser();
  if (!approved)
    return (
      <Dashboard role="OWNER" section="turfs" content={<OwnerUnverified />} />
    );
  const venue = await ownerPageVenue((await params).id, user.id);
  return (
    <Dashboard
      role="OWNER"
      section="turfs"
      pageTitle={venue.name}
      pageDescription="Owner preview of venue information."
      content={
        <div className="grid gap-5">
          <div>
            <Button asChild variant="outline">
              <Link href={`/owner/venues/${venue.id}?step=7`}>
                Back to review
              </Link>
            </Button>
          </div>
          <VenueInformation
            venue={{
              ...venue,
              pitches: venue.pitches.filter((pitch) => pitch.isActive),
            }}
          />
        </div>
      }
    />
  );
}
