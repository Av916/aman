import {
  BadgeCheck,
  Bell,
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
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "profile", label: "Profile", icon: CircleUserRound },
    settings,
  ],
  OWNER: [
    overview,
    { id: "turfs", label: "My Turfs", icon: Building2 },
    { id: "calendar", label: "Booking Calendar", icon: CalendarRange },
    { id: "check-in", label: "Check-in", icon: BadgeCheck },
    { id: "customers", label: "Customers", icon: Users },
    { id: "staff", label: "Staff", icon: ShieldCheck },
    { id: "reviews", label: "Reviews", icon: Bell },
    { id: "reservations", label: "Reservations", icon: ClipboardList },
    { id: "pricing", label: "Pricing", icon: Tag },
    { id: "revenue", label: "Analytics", icon: Banknote },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "refunds", label: "Refunds", icon: Banknote },
    { id: "coupons", label: "Coupons", icon: Tag },
    { id: "reports", label: "Reports", icon: ScrollText },
    { id: "policies", label: "Booking Policies", icon: ClipboardList },
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
    { id: "refunds", label: "Refunds", icon: Banknote },
    { id: "reviews", label: "Moderation", icon: Bell },
    { id: "coupons", label: "Platform Coupons", icon: Tag },
    { id: "reports", label: "Reports", icon: ScrollText },
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
