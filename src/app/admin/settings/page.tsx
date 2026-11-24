import { Dashboard } from "@/components/layouts/dashboard";
import { FeeSettings } from "@/components/operations/admin-actions";
import { requireDashboardRole } from "@/lib/auth";
import { feeSetting } from "@/modules/admin/operations";
export default async function Page() {
  await requireDashboardRole("ADMIN");
  return (
    <Dashboard
      role="ADMIN"
      section="settings"
      pageTitle="Platform settings"
      pageDescription="Changes apply to future quotes and require an audit reason."
      content={<FeeSettings amount={await feeSetting()} />}
    />
  );
}
