import { findProfile } from "@/modules/users/repository";
import { Dashboard } from "@/components/layouts/dashboard";
import { workspaceUser } from "@/modules/operations/page";
import { operationVenues } from "@/modules/operations/queries";
import type { Permission } from "@/modules/permissions/operations";
import { CalendarWorkspace } from "./calendar";
import { ReservationWorkspace } from "./reservations";
import { AnalyticsWorkspace } from "./analytics";
import {
  CheckInWorkspace,
  CouponWorkspace,
  CustomerWorkspace,
  PolicyWorkspace,
  RefundWorkspace,
  ReportsWorkspace,
  StaffWorkspace,
} from "./management";
import { ReviewWorkspace } from "./review-workspace";

const pageDetails = {
  calendar: [
    "calendar",
    "calendar",
    "Booking calendar",
    "Manage availability and reservations by date and pitch.",
  ],
  bookings: [
    "reservations",
    "calendar",
    "Reservations",
    "Search and manage online and offline reservations.",
  ],
  "check-in": [
    "check-in",
    "attend",
    "Check-in",
    "Verify arrivals and update attendance.",
  ],
  analytics: [
    "revenue",
    "finance",
    "Analytics",
    "Track bookings, occupancy, collections, and refunds.",
  ],
  refunds: [
    "refunds",
    "refund",
    "Refunds",
    "Review refund requests and settlement status.",
  ],
  coupons: [
    "coupons",
    "coupons",
    "Coupons",
    "Manage discount codes and redemption limits.",
  ],
  customers: [
    "customers",
    "customers",
    "Customers",
    "View registered and guest activity at assigned venues.",
  ],
  staff: [
    "staff",
    "staff",
    "Staff",
    "Invite teammates and manage their venue access.",
  ],
  policies: [
    "policies",
    "policies",
    "Booking policies",
    "Configure cancellation terms for future bookings.",
  ],
  payments: [
    "payments",
    "finance",
    "Payments",
    "Review online captures and recorded offline payments.",
  ],
  reports: [
    "reports",
    "finance",
    "Reports",
    "Filter business records and export authorized results.",
  ],
  reviews: [
    "reviews",
    "reviews",
    "Reviews",
    "Manage replies and review moderation.",
  ],
} as const satisfies Record<string, [string, Permission, string, string]>;

export async function WorkspacePage({
  page,
  admin = false,
  overview = false,
  reference,
}: {
  page: keyof typeof pageDetails;
  admin?: boolean;
  overview?: boolean;
  reference?: string;
}) {
  const [section, permission, title, description] = pageDetails[page];
  const { actor, staffSections } = await workspaceUser(permission, admin);
  const venues = await operationVenues(actor, permission);
  if (
    !admin &&
    actor.role === "OWNER" &&
    !venues.length &&
    (await findProfile(actor.id))?.ownerProfile?.verificationStatus !==
      "APPROVED"
  ) {
    return (
      <Dashboard
        role="OWNER"
        section={section}
        pageTitle={title}
        pageDescription={description}
        content={
          <p className="rounded-xl border border-border bg-surface p-5">
            This operation requires owner approval.
          </p>
        }
      />
    );
  }
  const content = {
    calendar: <CalendarWorkspace venues={venues} />,
    bookings: <ReservationWorkspace venues={venues} reference={reference} />,
    analytics: <AnalyticsWorkspace venues={venues} />,
    "check-in": <CheckInWorkspace />,
    customers: <CustomerWorkspace />,
    staff: <StaffWorkspace venues={venues} />,
    refunds: <RefundWorkspace admin={admin} />,
    coupons: <CouponWorkspace venues={venues} admin={admin} />,
    policies: <PolicyWorkspace venues={venues} />,
    payments: (
      <ReportsWorkspace venues={venues} admin={admin} initial="payments" />
    ),
    reports: <ReportsWorkspace venues={venues} admin={admin} />,
    reviews: <ReviewWorkspace admin={admin} />,
  }[page];
  return (
    <Dashboard
      role={admin ? "ADMIN" : "OWNER"}
      section={
        overview
          ? "overview"
          : admin && page === "bookings"
            ? "bookings"
            : section
      }
      staffSections={staffSections}
      pageTitle={overview ? "Operations overview" : title}
      pageDescription={description}
      content={content}
    />
  );
}
