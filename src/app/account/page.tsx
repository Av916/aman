import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { dashboardPath } from "@/config/navigation";

import { turfReturnPath } from "@/config/return-path";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await currentUser();
  const next = turfReturnPath((await searchParams).next);
  redirect(user ? (next ?? dashboardPath[user.role]) : "/login");
}
