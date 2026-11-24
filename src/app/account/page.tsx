import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { dashboardPath } from "@/config/navigation";

export default async function AccountPage() {
  const user = await currentUser();
  redirect(user ? dashboardPath[user.role] : "/login");
}
