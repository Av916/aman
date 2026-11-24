import Link from "next/link";
import { notFound } from "next/navigation";
import { Dashboard } from "@/components/layouts/dashboard";
import { OwnerUnverified } from "@/components/venues/management-list";
import { PitchEditor } from "@/components/venues/pitch-editor";
import { Button } from "@/components/ui/button";
import { ownerSlots } from "@/modules/pitches/service";
import {
  ownerPageVenue,
  ownerPageUser,
} from "@/modules/venues/management-pages";
import { dayQuery } from "@/modules/venues/venue.validation";

export default async function ManagePitch({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pitchId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { user, approved } = await ownerPageUser();
  if (!approved)
    return (
      <Dashboard role="OWNER" section="turfs" content={<OwnerUnverified />} />
    );
  const { id, pitchId } = await params;
  const [venue, query] = await Promise.all([
    ownerPageVenue(id, user.id),
    searchParams,
  ]);
  const pitch = venue.pitches.find((item) => item.id === pitchId);
  if (!pitch) notFound();
  const date = dayQuery.safeParse(query);
  const {
    slots,
    date: day,
    timezone,
    now,
  } = await ownerSlots(
    user.id,
    pitch.id,
    date.success ? date.data.date : undefined,
  );
  return (
    <Dashboard
      role="OWNER"
      section="turfs"
      pageTitle={pitch.name}
      pageDescription={`${venue.name} · Manage pitch information and daily availability.`}
      content={
        <div className="grid gap-5">
          <div>
            <Button asChild variant="outline">
              <Link href={`/owner/venues/${id}?step=5`}>Back to pitches</Link>
            </Button>
          </div>
          {["ARCHIVED", "SUSPENDED"].includes(venue.status) ? (
            <p className="text-muted">
              This pitch is read-only while its venue is{" "}
              {venue.status.toLowerCase()}.
            </p>
          ) : (
            <PitchEditor
              pitch={pitch}
              date={day}
              slots={slots}
              timezone={timezone}
              now={now}
              venueId={id}
              href={`/owner/venues/${id}/pitches/${pitchId}`}
            />
          )}
        </div>
      }
    />
  );
}
