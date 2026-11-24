import { WorkspacePage } from "@/components/operations/workspace-page";

export const metadata = { title: "Bookings" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  return (
    <WorkspacePage
      page="bookings"
      reference={typeof ref === "string" ? ref.slice(0, 80) : undefined}
    />
  );
}
