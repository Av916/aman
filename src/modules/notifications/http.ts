import { z } from "zod";
import { AppError } from "@/lib/api";
import { json, query, roleRoute } from "@/modules/venues/http";
import { notificationList, unreadCount, readNotifications } from "./service";

const list = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const notificationsGet = roleRoute("CUSTOMER", async (r, who) =>
  json("Notifications loaded.", {
    notifications: await notificationList(who, query(r, list).page),
    unread: await unreadCount(who),
  }),
);
export const countGet = roleRoute("CUSTOMER", async (_r, who) =>
  json("Unread count loaded.", { count: await unreadCount(who) }),
);
export const readPatch = roleRoute<{ id: string }>(
  "CUSTOMER",
  async (_r, who, { id }) => {
    const { count } = await readNotifications(who, id);
    if (!count) {
      const { getPrisma } = await import("@/lib/prisma");
      if (
        !(await getPrisma().notification.findFirst({
          where: { id, userId: who },
          select: { id: true },
        }))
      )
        throw new AppError(
          404,
          "NOTIFICATION_NOT_FOUND",
          "Notification not found.",
        );
    }
    return json("Notification marked as read.");
  },
);
export const readAllPatch = roleRoute("CUSTOMER", async (_r, who) =>
  json("Notifications marked as read.", await readNotifications(who)),
);
