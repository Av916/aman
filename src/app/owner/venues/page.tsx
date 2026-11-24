import { Dashboard } from "@/components/layouts/dashboard";
import {
  ManagementList,
  OwnerUnverified,
} from "@/components/venues/management-list";
import { ownerPageUser } from "@/modules/venues/management-pages";
import { listManagedVenues } from "@/modules/venues/venue.repository";
import { venueListQuery } from "@/modules/venues/venue.validation";

export const metadata = { title: "My Turfs" };
export default async function OwnerVenues({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { user, approved } = await ownerPageUser();
  const { status, ...raw } = await searchParams;
  const parsed = venueListQuery.safeParse({
    ...raw,
    status: status || undefined,
  });
  const query = parsed.success ? parsed.data : venueListQuery.parse({});
  return (
    <Dashboard
      role="OWNER"
      section="turfs"
      pageDescription="Manage venues, independent pitches, pricing and operating schedules."
      content={
        approved ? (
          <ManagementList
            list={await listManagedVenues(query, user.id)}
            q={query.q}
            status={query.status}
          />
        ) : (
          <OwnerUnverified />
        )
      }
    />
  );
}
