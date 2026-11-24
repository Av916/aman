import { requireDashboardRole } from "@/lib/auth";
import { Dashboard } from "@/components/layouts/dashboard";
import { auditIntegrity } from "@/modules/system/integrity";
import { SimpleTable } from "@/components/operations/shared";

export default async function Page() {
  await requireDashboardRole("ADMIN");
  const results = await auditIntegrity();
  return (
    <Dashboard
      role="ADMIN"
      section="system"
      pageTitle="Database integrity"
      pageDescription="Read-only inventory and finance checks."
      content={
        <SimpleTable
          columns={["Invariant", "Findings"]}
          rows={results.map((row) => [
            row.check.replaceAll("_", " "),
            row.count,
          ])}
        />
      }
    />
  );
}
