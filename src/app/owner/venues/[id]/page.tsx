import { Dashboard } from "@/components/layouts/dashboard";
import { OwnerUnverified } from "@/components/venues/management-list";
import { VenueWizard } from "@/components/venues/venue-wizard";
import { listAmenities } from "@/modules/amenities/service";
import {
  ownerPageVenue,
  ownerPageUser,
} from "@/modules/venues/management-pages";
import { venueSettings } from "@/modules/venues/settings";

export const metadata = { title: "Manage venue" };
export default async function ManageVenue({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { user, approved } = await ownerPageUser();
  if (!approved)
    return (
      <Dashboard role="OWNER" section="turfs" content={<OwnerUnverified />} />
    );
  const { id } = await params;
  const [venue, query, amenities] = await Promise.all([
    ownerPageVenue(id, user.id),
    searchParams,
    listAmenities(),
  ]);
  const nextStep =
    venue.status !== "DRAFT"
      ? 7
      : !venue.description || !venue.contactEmail || !venue.contactPhone
        ? 1
        : !venue.address ||
            !venue.city ||
            !venue.state ||
            !venue.postalCode ||
            venue.latitude === null
          ? 2
          : !venue.images.length
            ? 4
            : !venue.pitches.some((pitch) => pitch.isActive)
              ? 5
              : venue.pitches.some(
                    (pitch) =>
                      pitch.isActive &&
                      !pitch.hours.some((hour) => !hour.isClosed),
                  )
                ? 6
                : 7;
  const number = Number(query.step ?? nextStep);
  const step =
    Number.isInteger(number) && number >= 1 && number <= 7 ? number : 1;
  return (
    <Dashboard
      role="OWNER"
      section="turfs"
      pageTitle={venue.name}
      pageDescription="Manage this venue and review its public listing."
      content={
        <VenueWizard
          key={step}
          venue={venue}
          step={step}
          options={amenities}
          maxImages={venueSettings().MAX_VENUE_IMAGES}
        />
      }
    />
  );
}
