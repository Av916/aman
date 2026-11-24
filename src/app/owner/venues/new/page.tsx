import { Dashboard } from "@/components/layouts/dashboard";
import { OwnerUnverified } from "@/components/venues/management-list";
import { VenueWizard } from "@/components/venues/venue-wizard";
import { ownerPageUser } from "@/modules/venues/management-pages";

export const metadata = { title: "Create venue" };
export default async function NewVenue() {
  const { approved } = await ownerPageUser();
  return (
    <Dashboard
      role="OWNER"
      section="turfs"
      pageTitle="Create venue"
      pageDescription="Save a draft and return to finish it from My Turfs."
      content={approved ? <VenueWizard step={1} /> : <OwnerUnverified />}
    />
  );
}
