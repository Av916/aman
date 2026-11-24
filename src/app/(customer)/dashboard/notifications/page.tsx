import { Dashboard } from "@/components/layouts/dashboard";
import { Notifications } from "@/components/bookings/notification-list";
import { Pagination } from "@/components/venues/pagination";
import { requireDashboardRole } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { notificationList, unreadCount } from "@/modules/notifications/service";
export const metadata = { title: "Notifications" };
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireDashboardRole("CUSTOMER");
  const raw = Number((await searchParams).page ?? 1);
  const page = Number.isInteger(raw) && raw >= 1 && raw <= 1000 ? raw : 1;
  const [items, unread, total] = await Promise.all([
    notificationList(user.id, page),
    unreadCount(user.id),
    getPrisma().notification.count({ where: { userId: user.id } }),
  ]);
  return (
    <Dashboard
      role="CUSTOMER"
      section="notifications"
      pageDescription="Booking, payment, and refund updates."
      content={
        <>
          <Notifications items={items} unread={unread} />
          <Pagination
            href="/dashboard/notifications"
            params=""
            page={page}
            pages={Math.ceil(total / 25)}
          />
        </>
      }
    />
  );
}
