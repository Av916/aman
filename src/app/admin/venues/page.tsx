import { Dashboard } from "@/components/layouts/dashboard";
import { ManagementList } from "@/components/venues/management-list";
import { requireDashboardRole } from "@/lib/auth";
import { listManagedVenues } from "@/modules/venues/venue.repository";
import { venueListQuery } from "@/modules/venues/venue.validation";

export const metadata = { title: "Turf Management" };
export default async function AdminVenues({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireDashboardRole("ADMIN");
  const { status, ...raw } = await searchParams;
  const parsed = venueListQuery.safeParse({
    ...raw,
    status: status || undefined,
  });
  const query = parsed.success ? parsed.data : venueListQuery.parse({});
  return (
    <Dashboard
      role="ADMIN"
      section="turfs"
      pageDescription="Find venue submissions and review publication eligibility."
      content={
        <ManagementList
          list={await listManagedVenues(query)}
          admin
          q={query.q}
          status={query.status}
        />
      }
    />
  );
}
