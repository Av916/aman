import {
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  CalendarRange,
  CircleUserRound,
  ClipboardList,
  Compass,
  CreditCard,
  Heart,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";

const overview = { id: "overview", label: "Overview", icon: LayoutDashboard };
const settings = { id: "settings", label: "Settings", icon: Settings };
export const dashboardSections: Record<
  UserRole,
  { id: string; label: string; icon: LucideIcon }[]
> = {
  CUSTOMER: [
    overview,
    { id: "bookings", label: "My Bookings", icon: CalendarDays },
    { id: "turfs", label: "Explore Turfs", icon: Compass },
    { id: "favorites", label: "Favorites", icon: Heart },
    { id: "profile", label: "Profile", icon: CircleUserRound },
    settings,
  ],
  OWNER: [
    overview,
    { id: "turfs", label: "My Turfs", icon: Building2 },
    { id: "calendar", label: "Booking Calendar", icon: CalendarRange },
    { id: "reservations", label: "Reservations", icon: ClipboardList },
    { id: "pricing", label: "Pricing", icon: Tag },
    { id: "revenue", label: "Revenue", icon: Banknote },
    settings,
  ],
  ADMIN: [
    overview,
    { id: "users", label: "Users", icon: Users },
    { id: "owners", label: "Turf Owners", icon: BadgeCheck },
    { id: "turfs", label: "Turf Management", icon: Building2 },
    { id: "bookings", label: "Bookings", icon: CalendarDays },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "audit", label: "Audit Logs", icon: ScrollText },
    settings,
  ],
};

export const dashboardNames = {
  CUSTOMER: "Player dashboard",
  OWNER: "Owner dashboard",
  ADMIN: "Admin dashboard",
};
export const accountIcons = {
  verification: ShieldCheck,
  user: Users,
  business: Building2,
};
