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
  if (role === "CUSTOMER" && section === "favorites")
    return "/dashboard/favorites";
  if (role === "OWNER" && section === "pricing") return "/owner/venues";
  return section === "overview"
    ? dashboardPath[role]
    : `${dashboardPath[role]}?section=${section}`;
}

export function DashboardNav({
  role,
  selected,
}: {
  role: UserRole;
  selected: string;
}) {
  return (
    <aside className="border-b border-border bg-surface lg:min-h-dvh lg:border-r lg:border-b-0">
      <div className="hidden px-6 pt-6 pb-7 lg:block">
        <Logo />
      </div>
      <nav
        aria-label="Dashboard"
        className="flex flex-wrap gap-1.5 px-3 py-2 lg:grid lg:px-4 lg:py-0"
      >
        {dashboardSections[role].map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={dashboardHref(role, id)}
            aria-current={selected === id ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-background hover:text-foreground",
              selected === id &&
                "bg-highlight font-bold text-foreground hover:bg-highlight",
            )}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
