import { WorkspacePage } from "@/components/operations/workspace-page";

export const metadata = { title: "Bookings" };
export default function Page() {
  return <WorkspacePage page="bookings" admin />;
}
