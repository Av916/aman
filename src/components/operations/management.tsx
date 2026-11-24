"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { venueRequest } from "@/components/venues/api-client";
import { StaffRole } from "@/generated/prisma/enums";
import type { operationVenues } from "@/modules/operations/queries";
import type { staffList } from "@/modules/staff/service";
import type { listRefunds } from "@/modules/finance/operations";
import type { listCoupons } from "@/modules/coupons/service";
import {
  ActionForm,
  Dialog,
  Field,
  formatMoney,
  formatTime,
  gridClass,
  inputClass,
  LoadState,
  panelClass,
  readable,
  SimpleTable,
  Status,
  useOperation,
  type Json,
} from "./shared";

type Venues = Json<Awaited<ReturnType<typeof operationVenues>>>;
const values = (form: FormData, name: string) => String(form.get(name) ?? "");
const int = (form: FormData, name: string) => Number(form.get(name));
const staffRoles = Object.keys(StaffRole);
const bodyFor = (form: FormData) => ({
  email: values(form, "email"),
  role: values(form, "role"),
  venueIds: form.getAll("venues"),
});

export function StaffWorkspace({ venues }: { venues: Venues }) {
  const [openedAt] = useState(() => Date.now());
  const state =
    useOperation<Json<Awaited<ReturnType<typeof staffList>>>>(
      "/api/owner/staff",
    );
  const [selected, setSelected] = useState<string>();
  const member = state.data?.staff.find((item) => item.id === selected);
  return (
    <div className="grid gap-6">
      <section className={panelClass}>
        <h2 className="mb-4 text-lg font-bold">Invite a staff member</h2>
        <ActionForm
          label="Send invitation"
          disabled={!venues.length}
          submit={async (form) => {
            await venueRequest(
              "/api/owner/staff/invite",
              "POST",
              bodyFor(form),
            );
            state.reload();
          }}
        >
          <div className={gridClass}>
            <Field label="Verified account email">
              <input
                name="email"
                type="email"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Role">
              <select name="role" className={inputClass}>
                {staffRoles.map((role) => (
                  <option key={role} value={role}>
                    {readable(role)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <VenueChecks venues={venues} />
        </ActionForm>
      </section>
      {!state.data ? (
        <LoadState error={state.error} />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-bold">Staff directory</h2>
            <SimpleTable
              columns={["Name", "Role", "Status", "Venues", "Actions"]}
              rows={state.data.staff.map((row) => [
                row.user.name,
                readable(row.role),
                <Status key="status" value={row.status} />,
                row.assignments.map((item) => item.venue.name).join(", "),
                <button
                  className="underline"
                  key="manage"
                  onClick={() => setSelected(row.id)}
                >
                  Manage
                </button>,
              ])}
            />
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold">Invitations</h2>
            <SimpleTable
              columns={["Email", "Role", "Status", "Expires"]}
              rows={state.data.invitations.map((row) => [
                row.email,
                readable(row.role),
                row.acceptedAt
                  ? "Accepted"
                  : +new Date(row.expiresAt) <= openedAt
                    ? "Expired"
                    : "Awaiting acceptance",
                formatTime(row.expiresAt, "Asia/Kolkata", true),
              ])}
            />
          </section>
        </>
      )}
      {member && (
        <Dialog
          title={`Manage ${member.user.name}`}
          onClose={() => setSelected(undefined)}
        >
          <div className="grid gap-5">
            <ActionForm
              label="Update staff role and status"
              submit={async (form) => {
                await venueRequest(`/api/owner/staff/${member.id}`, "PATCH", {
                  role: form.get("role"),
                  status: form.get("status"),
                });
                state.reload();
                setSelected(undefined);
              }}
            >
              <Field label="Staff role">
                <select
                  className={inputClass}
                  name="role"
                  defaultValue={member.role}
                >
                  {staffRoles.map((role) => (
                    <option key={role} value={role}>
                      {readable(role)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Access status">
                <select
                  className={inputClass}
                  name="status"
                  defaultValue={member.status}
                >
                  <option>ACTIVE</option>
                  <option>SUSPENDED</option>
                  <option>REMOVED</option>
                </select>
              </Field>
            </ActionForm>
            <ActionForm
              label="Update assigned venues"
              submit={async (form) => {
                await venueRequest(
                  `/api/owner/staff/${member.id}/venues`,
                  "PUT",
                  { venueIds: form.getAll("venues") },
                );
                state.reload();
                setSelected(undefined);
              }}
            >
              <VenueChecks
                venues={venues}
                selected={member.assignments.map((item) => item.venueId)}
              />
            </ActionForm>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function VenueChecks({
  venues,
  selected = [],
}: {
  venues: Venues;
  selected?: string[];
}) {
  return (
    <fieldset className="flex flex-wrap gap-3">
      <legend className="mb-2 text-sm font-bold">Assigned venues</legend>
      {venues.map((venue) => (
        <label key={venue.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="venues"
            value={venue.id}
            defaultChecked={selected.includes(venue.id)}
          />
          {venue.name}
        </label>
      ))}
    </fieldset>
  );
}

export function StaffAcceptance() {
  const [accepted, setAccepted] = useState(false);
  return accepted ? (
    <Button asChild>
      <Link href="/owner/calendar">Open assigned venues</Link>
    </Button>
  ) : (
    <ActionForm
      label="Accept invitation"
      submit={async () => {
        const token = location.hash.slice(1);
        if (!token)
          throw new Error(
            "Open the invitation link from your email after signing in.",
          );
        await venueRequest("/api/staff/invitations/accept", "POST", { token });
        history.replaceState(null, "", location.pathname);
        setAccepted(true);
      }}
    >
      <p>
        Sign in with the email address named in the invitation, then accept
        access to the assigned venues.
      </p>
    </ActionForm>
  );
}

type Refund = Json<Awaited<ReturnType<typeof listRefunds>>>[number];
export function RefundWorkspace({ admin = false }: { admin?: boolean }) {
  const base = admin ? "/api/admin/refunds" : "/api/owner/refunds";
  const [page, setPage] = useState(1);
  const state = useOperation<{ refunds: Refund[] }>(`${base}?page=${page}`);
  const [selected, setSelected] = useState<Refund>();
  return (
    <div className="grid gap-4">
      {!state.data ? (
        <LoadState error={state.error} />
      ) : (
        <>
          <SimpleTable
            columns={[
              "Reference",
              "Booking / customer",
              "Original payment",
              "Refund",
              "Status",
              "Requested",
              "Processed",
            ]}
            rows={state.data.refunds.map((row) => [
              <button
                key="refund"
                className="font-bold underline"
                onClick={() => setSelected(row)}
              >
                {row.id.slice(0, 8)}
              </button>,
              row.booking.bookingNumber + " · " + row.booking.customerName,
              `${formatMoney(row.payment.amount)} · ${readable(row.payment.paymentMethod ?? row.payment.provider)}`,
              formatMoney(row.amount),
              <Status key="status" value={row.status} />,
              formatTime(row.createdAt, row.booking.timezone, true),
              row.processedAt
                ? formatTime(row.processedAt, row.booking.timezone, true)
                : "—",
            ])}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={state.data.refunds.length < 25}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
      {selected && (
        <Dialog
          title={`Refund ${selected.id.slice(0, 8)}`}
          onClose={() => setSelected(undefined)}
        >
          <div className="mb-4 grid gap-2 text-sm">
            <p>{selected.reason}</p>
            <p>
              {formatMoney(selected.amount)} · {selected.status}
            </p>
            <p>Provider reference {selected.providerRefundId ?? "Pending"}</p>
          </div>
          {selected.payment.provider === "OFFLINE" &&
            selected.status === "PENDING" && (
              <ActionForm
                label="Confirm offline refund was paid"
                submit={async (form) => {
                  await venueRequest(
                    `/api/owner/refunds/${selected.id}/approve`,
                    "POST",
                    { reference: form.get("reference") },
                  );
                  setSelected(undefined);
                  state.reload();
                }}
              >
                <Field label="Settlement reference">
                  <input
                    name="reference"
                    required
                    minLength={3}
                    maxLength={100}
                    className={inputClass}
                  />
                </Field>
              </ActionForm>
            )}
          {admin &&
            selected.payment.provider === "RAZORPAY" &&
            selected.status === "FAILED" && (
              <ActionForm
                label="Retry reconciliation"
                submit={async (form) => {
                  await venueRequest(`${base}/${selected.id}/retry`, "POST", {
                    reason: form.get("reason"),
                  });
                  setSelected(undefined);
                  state.reload();
                }}
              >
                <Field label="Reason for retry">
                  <input
                    name="reason"
                    required
                    minLength={5}
                    maxLength={300}
                    className={inputClass}
                  />
                </Field>
              </ActionForm>
            )}
        </Dialog>
      )}
    </div>
  );
}

export function PolicyWorkspace({ venues }: { venues: Venues }) {
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const base = venueId
    ? `/api/owner/venues/${venueId}/cancellation-policies`
    : "";
  type Policy = {
    id: string;
    name: string;
    version: number;
    description: string;
    isActive: boolean;
    rules: { minimumHoursBeforeBooking: number; refundPercentage: number }[];
  };
  const state = useOperation<{ policies: Policy[] }>(base);
  const [numberOfRules, setRuleCount] = useState(3);
  const [editing, setEditing] = useState<Policy>();
  if (!venueId)
    return (
      <p className={panelClass}>
        There are no venues where you can manage policies.
      </p>
    );
  return (
    <div className="grid gap-5">
      <Field label="Venue">
        <select
          className={inputClass}
          value={venueId}
          onChange={(event) => {
            setVenueId(event.target.value);
            setEditing(undefined);
          }}
        >
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
      </Field>
      <section className={panelClass}>
        <h2 className="mb-4 text-lg font-bold">
          {editing ? `New version of ${editing.name}` : "Create policy"}
        </h2>
        <ActionForm
          key={editing?.id ?? venueId}
          label="Save new version"
          submit={async (form) => {
            const rules = Array.from({ length: numberOfRules }, (_, i) => ({
              minimumHoursBeforeBooking: int(form, `hours${i}`),
              refundPercentage: int(form, `refund${i}`),
            }));
            await venueRequest(
              editing ? `/api/owner/cancellation-policies/${editing.id}` : base,
              editing ? "PATCH" : "POST",
              {
                name: form.get("name"),
                description: form.get("description"),
                rules,
              },
            );
            setEditing(undefined);
            state.reload();
          }}
        >
          <Field label="Policy name">
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              defaultValue={editing?.name}
              className={inputClass}
            />
          </Field>
          <Field label="Customer-facing description">
            <textarea
              name="description"
              maxLength={500}
              defaultValue={editing?.description}
              className={inputClass}
            />
          </Field>
          {Array.from({ length: numberOfRules }, (_, index) => (
            <div className="grid grid-cols-2 gap-3" key={index}>
              <Field label="Hours before start">
                <input
                  type="number"
                  name={`hours${index}`}
                  min={0}
                  max={720}
                  required
                  className={inputClass}
                  defaultValue={
                    editing?.rules[index]?.minimumHoursBeforeBooking ??
                    [24, 12, 0][index]
                  }
                />
              </Field>
              <Field label="Refund percentage">
                <input
                  type="number"
                  name={`refund${index}`}
                  min={0}
                  max={100}
                  required
                  className={inputClass}
                  defaultValue={
                    editing?.rules[index]?.refundPercentage ??
                    [100, 50, 0][index]
                  }
                />
              </Field>
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={numberOfRules >= 12}
              onClick={() => setRuleCount(numberOfRules + 1)}
            >
              Add threshold
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={numberOfRules <= 1}
              onClick={() => setRuleCount(numberOfRules - 1)}
            >
              Remove last
            </Button>
          </div>
        </ActionForm>
      </section>
      {!state.data ? (
        <LoadState error={state.error} />
      ) : (
        <div className="grid gap-3">
          {state.data.policies.map((policy) => (
            <section key={policy.id} className={panelClass}>
              <div className="mb-2 flex flex-wrap gap-2">
                <h3 className="font-bold">
                  {policy.name} · v{policy.version}
                </h3>
                {policy.isActive && <Status value="ACTIVE" />}
              </div>
              <p className="mb-2 text-sm text-muted">{policy.description}</p>
              <ul className="mb-3 text-sm">
                {policy.rules.map((rule) => (
                  <li key={rule.minimumHoursBeforeBooking}>
                    At least {rule.minimumHoursBeforeBooking} hours before start
                    · {rule.refundPercentage}% refund
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-start gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(policy);
                    setRuleCount(policy.rules.length);
                  }}
                >
                  Create revised version
                </Button>
                {!policy.isActive && (
                  <ActionForm
                    label="Activate for new bookings"
                    submit={async () => {
                      await venueRequest(
                        `/api/owner/cancellation-policies/${policy.id}/activate`,
                        "POST",
                        {},
                      );
                      state.reload();
                    }}
                  />
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function CouponWorkspace({
  venues,
  admin = false,
}: {
  venues: Venues;
  admin?: boolean;
}) {
  type Coupon = Json<Awaited<ReturnType<typeof listCoupons>>>[number];
  const base = admin ? "/api/admin/coupons" : "/api/owner/coupons";
  const state = useOperation<{ coupons: Coupon[] }>(base);
  const [editing, setEditing] = useState<Coupon>();
  const [openedAt] = useState(() => Date.now());
  const date = (v: string | undefined, offset: number) =>
    (v ?? new Date(openedAt + offset * 86_400_000).toISOString()).slice(0, 16);
  return (
    <div className="grid gap-5">
      <section className={panelClass}>
        <h2 className="mb-4 text-lg font-bold">
          {editing
            ? `Edit ${editing.code}`
            : admin
              ? "Create platform coupon"
              : "Create venue coupon"}
        </h2>
        <ActionForm
          key={editing?.id ?? "new"}
          disabled={!admin && !venues.length}
          label="Save coupon"
          submit={async (form) => {
            const selectable = (name: string) =>
              values(form, name) ? int(form, name) : null;
            await venueRequest(
              editing ? `${base}/${editing.id}` : base,
              editing ? "PATCH" : "POST",
              {
                venueId: admin ? null : form.get("venue"),
                code: form.get("code"),
                description: form.get("description"),
                discountType: form.get("type"),
                discountValue: int(form, "value"),
                maximumDiscount: selectable("max"),
                minimumBookingAmount: int(form, "min"),
                usageLimit: selectable("limit"),
                usageLimitPerCustomer: selectable("perCustomer"),
                startsAt: new Date(values(form, "start") + "Z").toISOString(),
                expiresAt: new Date(values(form, "end") + "Z").toISOString(),
                isActive: form.get("active") === "on",
              },
            );
            setEditing(undefined);
            state.reload();
          }}
        >
          <div className={gridClass}>
            {!admin && (
              <Field label="Venue">
                <select
                  name="venue"
                  defaultValue={editing?.venueId ?? venues[0]?.id}
                  className={inputClass}
                >
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Code">
              <input
                className={inputClass}
                name="code"
                pattern="[A-Za-z0-9_\-]{3,30}"
                required
                defaultValue={editing?.code}
              />
            </Field>
            <Field label="Discount type">
              <select
                className={inputClass}
                name="type"
                defaultValue={editing?.discountType}
              >
                <option value="FIXED">Fixed paise</option>
                <option value="PERCENTAGE">Percent</option>
              </select>
            </Field>
            <Field label="Discount value">
              <input
                className={inputClass}
                type="number"
                name="value"
                min={1}
                required
                defaultValue={editing?.discountValue}
              />
            </Field>
            <Field label="Maximum discount (paise)">
              <input
                className={inputClass}
                type="number"
                name="max"
                min={1}
                defaultValue={editing?.maximumDiscount ?? undefined}
              />
            </Field>
            <Field label="Minimum pitch subtotal (paise)">
              <input
                className={inputClass}
                type="number"
                name="min"
                min={0}
                defaultValue={editing?.minimumBookingAmount ?? 0}
              />
            </Field>
            <Field label="Total use limit">
              <input
                className={inputClass}
                type="number"
                name="limit"
                min={1}
                defaultValue={editing?.usageLimit ?? undefined}
              />
            </Field>
            <Field label="Per-customer limit">
              <input
                className={inputClass}
                type="number"
                name="perCustomer"
                min={1}
                defaultValue={editing?.usageLimitPerCustomer ?? undefined}
              />
            </Field>
            <Field label="Starts (UTC)">
              <input
                className={inputClass}
                type="datetime-local"
                name="start"
                required
                defaultValue={date(editing?.startsAt, 0)}
              />
            </Field>
            <Field label="Ends (UTC)">
              <input
                className={inputClass}
                type="datetime-local"
                name="end"
                required
                defaultValue={date(editing?.expiresAt, 30)}
              />
            </Field>
          </div>
          <Field label="Description">
            <input
              className={inputClass}
              name="description"
              maxLength={300}
              defaultValue={editing?.description}
            />
          </Field>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing?.isActive ?? true}
            />{" "}
            Active
          </label>
        </ActionForm>
      </section>
      {!state.data ? (
        <LoadState error={state.error} />
      ) : (
        <SimpleTable
          columns={["Code", "Discount", "Use limit", "Status", "Manage"]}
          rows={state.data.coupons.map((row) => [
            row.code,
            row.discountType === "FIXED"
              ? formatMoney(row.discountValue)
              : row.discountValue + "%",
            row.usageLimit ?? "Unlimited",
            row.isActive ? "Active" : "Inactive",
            <button
              key="edit"
              className="underline"
              onClick={() => setEditing(row)}
            >
              Edit
            </button>,
          ])}
        />
      )}
    </div>
  );
}

export function ReportsWorkspace({
  venues,
  admin = false,
  initial = "bookings",
}: {
  venues: Venues;
  admin?: boolean;
  initial?: string;
}) {
  const base = admin ? "/api/admin/reports" : "/api/owner/reports";
  const [params, setParams] = useState(`kind=${initial}`);
  const state = useOperation<{ rows: (string | number | null)[][] }>(
    `${base}?${params}`,
  );
  return (
    <div className="grid gap-5">
      <form
        className={`${panelClass} ${gridClass}`}
        onSubmit={(event) => {
          event.preventDefault();
          setParams(
            new URLSearchParams(
              [...new FormData(event.currentTarget)]
                .filter(([, value]) => value)
                .map(([key, value]) => [key, String(value)]),
            ).toString(),
          );
        }}
      >
        <Field label="Report">
          <select name="kind" className={inputClass} defaultValue={initial}>
            {[
              "bookings",
              "revenue",
              "payments",
              "refunds",
              "occupancy",
              "cancellations",
              "customers",
              "pitches",
            ].map((kind) => (
              <option key={kind} value={kind}>
                {readable(kind)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Venue">
          <select name="venueId" className={inputClass}>
            <option value="">All authorized venues</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pitch">
          <select name="pitchId" className={inputClass}>
            <option value="">All pitches</option>
            {venues.flatMap((venue) =>
              venue.pitches.map((pitch) => (
                <option key={pitch.id} value={pitch.id}>
                  {venue.name} · {pitch.name}
                </option>
              )),
            )}
          </select>
        </Field>
        <Field label="From">
          <input name="from" type="date" className={inputClass} />
        </Field>
        <Field label="Through">
          <input name="to" type="date" className={inputClass} />
        </Field>
        <Field label="Booking status">
          <select name="status" className={inputClass}>
            <option value="">All</option>
            {[
              "CONFIRMED",
              "CHECKED_IN",
              "COMPLETED",
              "CANCELLED",
              "NO_SHOW",
              "PENDING_PAYMENT",
              "EXPIRED",
              "RESCHEDULED",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Payment status">
          <select name="payment" className={inputClass}>
            <option value="">All</option>
            {[
              "CAPTURED",
              "UNPAID",
              "PARTIALLY_REFUNDED",
              "REFUNDED",
              "REFUND_PENDING",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Button type="submit">Run report</Button>
        <Button asChild variant="outline">
          <Link href={`${base}/export?${params}`}>Download CSV</Link>
        </Button>
      </form>
      {!state.data ? (
        <LoadState error={state.error} />
      ) : (
        <SimpleTable
          columns={state.data.rows[0]?.map(String) ?? []}
          rows={state.data.rows.slice(1)}
        />
      )}
    </div>
  );
}

export function CustomerWorkspace() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  const [page, setPage] = useState(1);
  type CustomerRow = {
    id: string;
    customerName: string;
    type: string;
    _count: number;
    _max: { startAt: string };
  };
  const state = useOperation<{ customers: CustomerRow[] }>(
    `/api/owner/customers?search=${encodeURIComponent(search)}&page=${page}`,
  );
  const record = useOperation<{
    spending: number;
    groups: { status: string; _count: number }[];
    bookings: {
      id: string;
      bookingNumber: string;
      venueName: string;
      pitchName: string;
      status: string;
      startAt: string;
      timezone: string;
      customerPhone: string | null;
      customerEmail: string | null;
    }[];
  }>(selected ? `/api/owner/customers/${selected}` : "");
  return (
    <div className="grid gap-4">
      <section className={panelClass}>
        <ActionForm
          label="Find customers"
          submit={async (form) => {
            setSearch(values(form, "search"));
            setPage(1);
          }}
        >
          <Field label="Customer name">
            <input name="search" className={inputClass} maxLength={80} />
          </Field>
        </ActionForm>
      </section>
      {!state.data ? (
        <LoadState error={state.error} />
      ) : (
        <SimpleTable
          columns={["Customer", "Type", "Bookings", "Last booking"]}
          rows={state.data.customers.map((row) => [
            <button
              key="open"
              className="font-bold underline"
              onClick={() => setSelected(row.id)}
            >
              {row.customerName}
            </button>,
            row.type,
            row._count,
            formatTime(row._max.startAt, "Asia/Kolkata", true),
          ])}
        />
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={!state.data || state.data.customers.length < 25}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      {selected && (
        <Dialog
          title="Customer booking history"
          onClose={() => setSelected(undefined)}
        >
          {!record.data ? (
            <LoadState error={record.error} />
          ) : (
            <>
              <p>
                Contact{" "}
                {[
                  record.data.bookings[0]?.customerEmail,
                  record.data.bookings[0]?.customerPhone,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Unavailable"}
              </p>
              <p className="mb-3 text-sm">
                Net collected {formatMoney(record.data.spending)} ·{" "}
                {record.data.groups
                  .map((group) => `${readable(group.status)} ${group._count}`)
                  .join(" · ")}
              </p>
              <SimpleTable
                columns={["Reference", "Venue / Pitch", "Start", "Status"]}
                rows={record.data.bookings.map((booking) => [
                  booking.bookingNumber,
                  booking.venueName + " / " + booking.pitchName,
                  formatTime(booking.startAt, booking.timezone, true),
                  readable(booking.status),
                ])}
              />
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}

export function CheckInWorkspace() {
  const [confirm, setConfirm] = useState("");
  const [reference, setReference] = useState("");
  const [selected, setSelected] = useState<string>();
  const state = useOperation<{
    bookings: {
      id: string;
      bookingNumber: string;
      customerName: string;
      venueName: string;
      pitchName: string;
      status: string;
    }[];
  }>(
    reference
      ? `/api/owner/bookings?search=${encodeURIComponent(reference)}`
      : "",
  );
  return (
    <div className="grid gap-4">
      <section className={panelClass}>
        <h2 className="mb-3 font-bold">Verify check-in token</h2>
        <ActionForm
          label="Check in customer"
          submit={async (form) => {
            const { booking } = await venueRequest<{
              booking: { bookingNumber: string };
            }>("/api/owner/check-in", "POST", { token: form.get("token") });
            setConfirm(booking.bookingNumber);
          }}
        >
          <Field label="Customer’s check-in token">
            <input
              required
              name="token"
              className={inputClass}
              autoComplete="off"
              minLength={32}
              maxLength={64}
            />
          </Field>
        </ActionForm>
        {confirm && (
          <p role="status" className="text-sm">
            {confirm} checked in.
          </p>
        )}
      </section>
      <section className={panelClass}>
        <h2 className="mb-3 font-bold">Find a reservation</h2>
        <ActionForm
          label="Search bookings"
          submit={async (form) => {
            setReference(values(form, "reference"));
          }}
        >
          <Field label="Booking reference or customer name">
            <input
              name="reference"
              className={inputClass}
              required
              maxLength={80}
            />
          </Field>
        </ActionForm>
      </section>
      {reference &&
        (!state.data ? (
          <LoadState error={state.error} />
        ) : (
          <SimpleTable
            columns={["Reference", "Customer", "Venue / Pitch", "Status"]}
            rows={state.data.bookings.map((row) => [
              <button
                key="open"
                className="font-bold underline"
                onClick={() => setSelected(row.id)}
              >
                {row.bookingNumber}
              </button>,
              row.customerName,
              row.venueName + " / " + row.pitchName,
              readable(row.status),
            ])}
          />
        ))}
      {selected && (
        <CheckInDetail
          id={selected}
          close={() => setSelected(undefined)}
          reload={state.reload}
        />
      )}
    </div>
  );
}
import { BookingDetails } from "./booking-actions";
function CheckInDetail({
  id,
  close,
  reload,
}: {
  id: string;
  close: () => void;
  reload: () => void;
}) {
  return <BookingDetails id={id} onClose={close} onChange={reload} />;
}
