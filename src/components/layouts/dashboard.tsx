import { getPrisma } from "@/lib/prisma";
import { venueScope } from "@/modules/permissions/operations";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  CircleUserRound,
  MailCheck,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/branding/logo";
import { AccountForm } from "@/components/forms/account-form";
import { Logout } from "@/components/shared/logout";
import { ThemeMenu } from "@/components/shared/theme-menu";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  accountIcons,
  dashboardNames,
  dashboardSections,
} from "@/config/dashboard";
import { dashboardPath } from "@/config/navigation";
import type { UserRole } from "@/generated/prisma/enums";
import { currentUser, requireDashboardRole } from "@/lib/auth";
import { ownerVenueCounts } from "@/modules/venues/venue.repository";
import { accountCounts } from "@/modules/users/admin-repository";
import { findProfile, type Profile } from "@/modules/users/repository";
import { AdminData } from "./admin-data";
import { DashboardNav, dashboardHref } from "./dashboard-nav";

const verification = {
  PENDING: {
    label: "Pending review",
    tone: "amber",
    description:
      "Your business details have been submitted. Sensitive owner actions require approval.",
  },
  APPROVED: {
    label: "Approved",
    tone: "green",
    description: "Your owner account has been approved.",
  },
  REJECTED: {
    label: "Review declined",
    tone: "red",
    description: "Sensitive owner actions remain restricted.",
  },
} as const;

export async function Dashboard({
  role,
  section,
  content,
  pageTitle,
  pageDescription,
  staffSections,
}: {
  role: UserRole;
  section?: string;
  content?: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  staffSections?: string[];
}) {
  const user =
    staffSections && role === "OWNER" && content
      ? await currentUser()
      : await requireDashboardRole(role);
  if (!user) redirect("/login");
  const profile = await findProfile(user.id);
  if (!profile || profile.status !== "ACTIVE") redirect("/login");
  if (profile.role !== role && !staffSections)
    redirect(dashboardPath[profile.role]);

  const selected =
    dashboardSections[role].find(({ id }) => id === section) ??
    dashboardSections[role][0];
  const overview = selected.id === "overview";
  if (
    !content &&
    (selected.id === "turfs" ||
      selected.id === "favorites" ||
      (role === "CUSTOMER" &&
        ["bookings", "notifications"].includes(selected.id)) ||
      (role === "OWNER" && selected.id === "pricing"))
  )
    redirect(dashboardHref(role, selected.id));
  const adminData =
    role === "ADMIN" &&
    (selected.id === "users" ||
      selected.id === "owners" ||
      selected.id === "audit")
      ? selected.id
      : undefined;
  const title = overview
    ? `Welcome, ${profile.name.split(/\s+/)[0]}`
    : selected.label;
  const description = overview
    ? "Here’s your PitchMate account at a glance."
    : adminData
      ? "Showing up to 25 recent records."
      : selected.id === "settings"
        ? "Manage your account and sign-in details."
        : selected.id === "profile"
          ? "Update your name and contact details."
          : "This section will open in a future release.";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Logo />
        <ThemeMenu />
      </div>
      <DashboardNav
        role={role}
        selected={selected.id}
        allowed={staffSections}
      />
      <div className="min-w-0">
        <header className="hidden h-[5.15rem] items-center justify-between gap-3 border-b border-border bg-surface px-8 lg:flex">
          <span className="font-bold">{dashboardNames[role]}</span>
          <div className="flex items-center gap-3">
            <ThemeMenu />
            <Avatar name={profile.name} />
            <span className="max-w-[15rem] truncate text-sm font-bold">
              {profile.name}
            </span>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[78rem] px-5 py-8 sm:px-8 lg:py-10"
        >
          <Breadcrumbs
            items={
              overview
                ? [{ label: dashboardNames[role] }]
                : [
                    { label: dashboardNames[role], href: dashboardPath[role] },
                    { label: selected.label },
                  ]
            }
          />
          <PageHeader
            title={pageTitle ?? title}
            description={pageDescription ?? description}
          />
          {content ??
            (overview ? (
              <Overview profile={profile} />
            ) : adminData ? (
              <AdminData section={adminData} />
            ) : selected.id === "profile" || selected.id === "settings" ? (
              <AccountSettings
                profile={profile}
                settings={selected.id === "settings"}
              />
            ) : (
              <EmptyState
                title={selected.label}
                description={
                  role === "OWNER" &&
                  profile.ownerProfile?.verificationStatus !== "APPROVED"
                    ? "This feature is planned for a future release and requires owner approval."
                    : "This feature is planned for a future release."
                }
                icon={selected.icon}
              />
            ))}
        </main>
      </div>
    </div>
  );
}

async function Overview({ profile }: { profile: Profile }) {
  if (profile.role === "ADMIN") {
    const [users, owners, pending] = await accountCounts();
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Registered accounts"
          value={users}
          icon={accountIcons.user}
        />
        <StatCard
          label="Owner profiles"
          value={owners}
          icon={accountIcons.business}
        />
        <StatCard
          label="Owners pending review"
          value={pending}
          icon={accountIcons.verification}
        />
      </div>
    );
  }
  if (profile.role === "OWNER" && profile.ownerProfile) {
    const status = verification[profile.ownerProfile.verificationStatus];
    const venueCounts =
      profile.ownerProfile.verificationStatus === "APPROVED"
        ? await ownerVenueCounts(profile.id)
        : null;
    return (
      <div className="grid gap-5">
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <BadgeCheck size={23} className="text-brand-dot" />
            <h2 className="text-xl font-extrabold">Owner verification</h2>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-3 text-muted">{status.description}</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Business name</dt>
              <dd className="font-bold">{profile.ownerProfile.businessName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Business phone</dt>
              <dd className="font-bold">
                {profile.ownerProfile.businessPhone}
              </dd>
            </div>
          </dl>
        </Card>
        {venueCounts && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Active venue records"
                value={venueCounts[0]}
                icon={accountIcons.business}
              />
              <StatCard
                label="Published venues"
                value={venueCounts[1]}
                icon={accountIcons.verification}
              />
              <StatCard
                label="Venues in review"
                value={venueCounts[2]}
                icon={CalendarDays}
              />
            </div>
            <div>
              <Button asChild>
                <Link href="/owner/venues">Manage venues</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }
  const hasVenueWorkspace = await getPrisma().venue.findFirst({
    where: venueScope({ id: profile.id, role: profile.role }, "calendar"),
    select: { id: true },
  });
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Email status" value="Verified" icon={MailCheck} />
        <StatCard label="Account type" value="Player" icon={CircleUserRound} />
      </div>
      <EmptyState
        title="Your bookings"
        description="See your upcoming reservations and recent booking history."
        icon={CalendarDays}
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/turfs">Explore cricket turfs</Link>
        </Button>
        {hasVenueWorkspace && (
          <Button asChild variant="outline">
            <Link href="/owner/calendar">Venue workspace</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href={dashboardHref(profile.role, "profile")}>
            Edit profile
          </Link>
        </Button>
      </div>
    </div>
  );
}

function AccountSettings({
  profile,
  settings,
}: {
  profile: Profile;
  settings: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {(!settings || profile.role !== "CUSTOMER") && (
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-extrabold">Personal details</h2>
          <p className="mb-4 break-all text-sm text-muted">{profile.email}</p>
          <AccountForm
            mode="profile"
            initialValues={{ name: profile.name, phone: profile.phone ?? "" }}
          />
        </Card>
      )}
      {settings && (
        <Card className="p-6">
          <h2 className="text-xl font-extrabold">Change password</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Changing your password signs you out on every device.
          </p>
          <AccountForm mode="change-password" />
          <div className="mt-6 border-t border-border pt-5">
            <Logout />
          </div>
        </Card>
      )}
    </div>
  );
}
