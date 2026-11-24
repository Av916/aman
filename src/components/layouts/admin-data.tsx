import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import {
  listRecentAuditEvents,
  listRecentOwners,
  listRecentUsers,
} from "@/modules/users/admin-repository";

type TableData = {
  columns: string[];
  rows: { key: string; values: string[] }[];
};

function RecentTable({ columns, rows }: TableData) {
  if (!rows.length)
    return (
      <EmptyState
        title="No records yet"
        description="New records will appear here."
      />
    );
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[35rem] border-collapse text-left text-sm">
        <caption className="sr-only">Most recent records</caption>
        <thead className="bg-highlight">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="p-3 font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, values }) => (
            <tr className="border-t border-border" key={key}>
              {values.map((value, index) => (
                <td key={columns[index]} className="p-3 break-all">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export async function AdminData({
  section,
}: {
  section: "users" | "owners" | "audit";
}) {
  if (section === "users") {
    const records = await listRecentUsers();
    return (
      <RecentTable
        columns={["Name", "Email", "Role", "Status"]}
        rows={records.map((user) => ({
          key: user.id,
          values: [user.name, user.email, user.role, user.status],
        }))}
      />
    );
  }
  if (section === "owners") {
    const records = await listRecentOwners();
    return (
      <RecentTable
        columns={["Business", "Account", "Verification"]}
        rows={records.map((owner) => ({
          key: owner.id,
          values: [
            owner.businessName,
            owner.user.email,
            owner.verificationStatus,
          ],
        }))}
      />
    );
  }
  const records = await listRecentAuditEvents();
  const time = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  return (
    <RecentTable
      columns={["Event", "Resource", "Time (UTC)"]}
      rows={records.map((event) => ({
        key: event.id,
        values: [event.action, event.entityType, time.format(event.createdAt)],
      }))}
    />
  );
}
