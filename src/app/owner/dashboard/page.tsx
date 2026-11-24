import { Dashboard } from "@/components/layouts/dashboard";
import { WorkspacePage } from "@/components/operations/workspace-page";
import { currentUser } from "@/lib/auth";
import { findProfile } from "@/modules/users/repository";

export const metadata = { title: "Owner dashboard" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const actor = await currentUser();
  if (section && section !== "overview")
    return <Dashboard role="OWNER" section={section} />;
  if (
    actor?.role === "OWNER" &&
    (await findProfile(actor.id))?.ownerProfile?.verificationStatus !==
      "APPROVED"
  )
    return <Dashboard role="OWNER" />;
  return <WorkspacePage page="analytics" overview />;
}
