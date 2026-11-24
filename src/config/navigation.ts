import type { UserRole } from "@/generated/prisma/enums";

export const dashboardPath = {
  CUSTOMER: "/dashboard",
  OWNER: "/owner/dashboard",
  ADMIN: "/admin/dashboard",
} satisfies Record<UserRole, string>;
