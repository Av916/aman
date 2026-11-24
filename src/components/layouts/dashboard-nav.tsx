import { WorkspaceSidebar } from "./workspace-sidebar";
import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { dashboardSections } from "@/config/dashboard";
import { dashboardPath } from "@/config/navigation";
import type { UserRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export function dashboardHref(role: UserRole, section: string) {
  if (section === "turfs")
    return {
      CUSTOMER: "/turfs",
      OWNER: "/owner/venues",
      ADMIN: "/admin/venues",
    }[role];
  if (
    role === "CUSTOMER" &&
    ["favorites", "bookings", "notifications"].includes(section)
  )
    return `/dashboard/${section}`;
  if (role === "OWNER" && section === "pricing") return "/owner/venues";
  if (role === "OWNER") {
    if (section === "reservations") return "/owner/bookings";
    if (section === "revenue") return "/owner/analytics";
    if (
      [
        "calendar",
        "check-in",
        "customers",
        "staff",
        "reviews",
        "payments",
        "refunds",
        "coupons",
        "reports",
        "policies",
      ].includes(section)
    )
      return `/owner/${section}`;
  }
  if (role === "ADMIN") {
    if (section === "audit") return "/admin/audit-logs";
    if (
      [
        "users",
        "owners",
        "bookings",
        "payments",
        "refunds",
        "reviews",
        "coupons",
        "reports",
        "settings",
      ].includes(section)
    )
      return `/admin/${section}`;
  }
  return section === "overview"
    ? dashboardPath[role]
    : `${dashboardPath[role]}?section=${section}`;
}

export function DashboardNav({
  role,
  selected,
  allowed,
}: {
  role: UserRole;
  selected: string;
  allowed?: string[];
}) {
  const sections = dashboardSections[role].filter(
    ({ id }) => !allowed || allowed.includes(id),
  );
  const groups =
    role === "OWNER"
      ? [
          {
            label: "Workspace",
            ids: ["overview", "calendar", "reservations", "check-in"],
          },
          {
            label: "Management",
            ids: ["turfs", "customers", "staff", "reviews"],
          },
          {
            label: "Finance",
            ids: ["revenue", "payments", "refunds", "coupons", "reports"],
          },
          { label: "Settings", ids: ["policies", "pricing", "settings"] },
        ]
      : [{ label: "", ids: sections.map(({ id }) => id) }];
  return (
    <WorkspaceSidebar brand={<Logo />}>
      <nav aria-label="Dashboard" className="grid gap-3 px-3 pb-4 lg:px-3">
        {groups.map(({ label: group, ids }) => {
          const visible = ids.flatMap((id) =>
            sections.filter((section) => section.id === id),
          );
          if (!visible.length) return null;
          return (
            <div key={group || role} className="grid gap-0.5">
              {group && (
                <div className="px-3 py-1.5 text-xs font-bold text-muted lg:group-data-[collapsed=true]/sidebar:sr-only">
                  {group}
                </div>
              )}
              {visible.map(({ id, label, icon: Icon }) => (
                <Link
                  key={id}
                  title={label}
                  href={dashboardHref(role, id)}
                  aria-current={selected === id ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-background hover:text-foreground lg:group-data-[collapsed=true]/sidebar:justify-center lg:group-data-[collapsed=true]/sidebar:px-0",
                    selected === id &&
                      "bg-highlight font-bold text-foreground hover:bg-highlight",
                  )}
                >
                  <Icon size={17} aria-hidden className="shrink-0" />
                  <span className="lg:group-data-[collapsed=true]/sidebar:sr-only">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
    </WorkspaceSidebar>
  );
}
