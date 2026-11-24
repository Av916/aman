"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PitchType,
  PricingRuleType,
  SurfaceType,
  type SlotStatus,
} from "@/generated/prisma/enums";
import type { ManagedVenue } from "@/modules/venues/venue.types";
import { minutesToClock, dayString } from "@/modules/schedules/time";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { venueRequest } from "./api-client";
import {
  ConfirmAction,
  FormError,
  FormField,
  TextField,
  choiceClass,
  formValues,
  fromClock,
  nullable,
  number,
  panelClass,
  useManagementRequest,
  value,
} from "./management-controls";
import { human, money, slotLabel, slotTime, weekdayNames } from "./format";

type Pitch = ManagedVenue["pitches"][number];
type Slot = {
  id: string;
  startAt: Date;
  endAt: Date;
  price: number;
  status: SlotStatus;
};

export function PitchForm({
  venueId,
  pitch,
}: {
  venueId: string;
  pitch?: Pitch;
}) {
  const { run, busy, error } = useManagementRequest();
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        const data = formValues(event);
        const numbers = Object.fromEntries(
          [
            "capacity",
            "lengthInMeters",
            "widthInMeters",
            "slotDurationMinutes",
            "minimumBookingMinutes",
            "maximumBookingMinutes",
          ].map((key) => [key, number(data, key)]),
        );
        const payload = {
          ...numbers,
          name: value(data, "name"),
          description: value(data, "description"),
          pitchType: value(data, "pitchType"),
          surfaceType: value(data, "surfaceType"),
          basePrice: Math.round(number(data, "basePrice") * 100),
          isIndoor: data.has("isIndoor"),
          isActive: data.has("isActive"),
        };
        void run(
          () =>
            venueRequest(
              pitch
                ? `/api/owner/pitches/${pitch.id}`
                : `/api/owner/venues/${venueId}/pitches`,
              pitch ? "PATCH" : "POST",
              payload,
            ),
          pitch ? "Pitch saved." : "Pitch added.",
        );
      }}
    >
      <TextField
        name="name"
        label="Pitch name"
        required
        minLength={2}
        maxLength={100}
        defaultValue={pitch?.name}
      />
      <FormField label="Pitch description">
        <textarea
          name="description"
          className={`${choiceClass} min-h-24 p-3`}
          maxLength={1000}
          defaultValue={pitch?.description}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Cricket pitch type">
          <select
            name="pitchType"
            className={choiceClass}
            defaultValue={pitch?.pitchType}
          >
            {Object.values(PitchType).map((item) => (
              <option key={item} value={item}>
                {human(item)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Surface type">
          <select
            name="surfaceType"
            className={choiceClass}
            defaultValue={pitch?.surfaceType}
          >
            {Object.values(SurfaceType).map((item) => (
              <option key={item} value={item}>
                {human(item)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          name="capacity"
          label="Capacity"
          type="number"
          min="1"
          max="500"
          defaultValue={pitch?.capacity ?? 12}
          required
        />
        <TextField
          name="lengthInMeters"
          label="Length in meters"
          type="number"
          min="1"
          max="250"
          defaultValue={pitch?.lengthInMeters ?? 30}
          required
        />
        <TextField
          name="widthInMeters"
          label="Width in meters"
          type="number"
          min="1"
          max="250"
          defaultValue={pitch?.widthInMeters ?? 15}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          name="basePrice"
          label="Base hourly price (₹)"
          type="number"
          min="0"
          max="100000"
          step="0.01"
          defaultValue={pitch ? pitch.basePrice / 100 : 800}
          required
        />
        <FormField label="Slot duration">
          <select
            name="slotDurationMinutes"
            defaultValue={pitch?.slotDurationMinutes ?? 60}
            className={choiceClass}
          >
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </FormField>
        <TextField
          name="minimumBookingMinutes"
          label="Minimum booking minutes"
          type="number"
          min="30"
          max="1440"
          step="30"
          defaultValue={pitch?.minimumBookingMinutes ?? 60}
          required
        />
        <TextField
          name="maximumBookingMinutes"
          label="Maximum booking minutes"
          type="number"
          min="30"
          max="1440"
          step="30"
          defaultValue={pitch?.maximumBookingMinutes ?? 180}
          required
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex min-h-11 items-center gap-2">
          <input
            name="isIndoor"
            type="checkbox"
            defaultChecked={pitch?.isIndoor}
          />{" "}
          Indoor pitch
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={pitch?.isActive ?? true}
          />{" "}
          Active pitch
        </label>
      </div>
      <FormError error={error} />
      <Button type="submit" disabled={busy}>
        {pitch ? "Save pitch" : "Add pitch"}
      </Button>
    </form>
  );
}

function editClock(value: number | null, fallback: string) {
  return value === null
    ? fallback
    : value === 1440
      ? "00:00"
      : minutesToClock(value);
}
type ScheduleRow = {
  key: string;
  day: number;
  open: string;
  close: string;
  closed: boolean;
};

export function WeeklyForm({ pitch }: { pitch: Pitch }) {
  const { run, busy, error } = useManagementRequest();
  const [rows, setRows] = useState<ScheduleRow[]>(() =>
    weekdayNames.flatMap((_day, index) => {
      const hours = pitch.hours.filter((row) => row.dayOfWeek === index);
      return hours.length
        ? hours.map((row) => ({
            key: row.id,
            day: index,
            open: editClock(row.openingTime, "06:00"),
            close: editClock(row.closingTime, "22:00"),
            closed: row.isClosed,
          }))
        : [
            {
              key: `day-${index}`,
              day: index,
              open: "06:00",
              close: "22:00",
              closed: true,
            },
          ];
    }),
  );
  const change = (key: string, data: Partial<ScheduleRow>) =>
    setRows((items) =>
      items.map((row) => (row.key === key ? { ...row, ...data } : row)),
    );
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const hours = rows.map((row) => ({
          dayOfWeek: row.day,
          openingTime: row.closed ? null : fromClock(row.open),
          closingTime: row.closed ? null : fromClock(row.close) || 1440,
          isClosed: row.closed,
        }));
        void run(
          () =>
            venueRequest(`/api/owner/pitches/${pitch.id}/schedule`, "PUT", {
              hours,
            }),
          "Schedule saved and availability updated.",
        );
      }}
    >
      <p className="text-sm text-muted">
        A closing time earlier than opening continues into the following day.
      </p>
      {weekdayNames.map((day, index) => (
        <fieldset
          key={day}
          className="grid gap-2 rounded-xl border border-border p-3"
        >
          <legend className="px-2 text-sm font-bold">{day}</legend>
          {rows
            .filter((row) => row.day === index)
            .map((row, slotIndex) => (
              <div
                key={row.key}
                className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <TextField
                  label={`${day} opening`}
                  type="time"
                  value={row.open}
                  required={!row.closed}
                  disabled={row.closed}
                  onChange={(e) => change(row.key, { open: e.target.value })}
                />
                <TextField
                  label={`${day} closing`}
                  type="time"
                  value={row.close}
                  required={!row.closed}
                  disabled={row.closed}
                  onChange={(e) => change(row.key, { close: e.target.value })}
                />
                {slotIndex === 0 &&
                rows.filter((item) => item.day === index).length === 1 ? (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.closed}
                      onChange={(e) =>
                        change(row.key, { closed: e.target.checked })
                      }
                    />{" "}
                    Closed
                  </label>
                ) : (
                  slotIndex > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setRows((items) =>
                          items.filter((item) => item.key !== row.key),
                        )
                      }
                    >
                      Remove interval
                    </Button>
                  )
                )}
                {slotIndex === 0 &&
                  !row.closed &&
                  rows.filter((item) => item.day === index).length < 6 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setRows((items) => [
                          ...items,
                          {
                            key: crypto.randomUUID(),
                            day: index,
                            open: "18:00",
                            close: "22:00",
                            closed: false,
                          },
                        ])
                      }
                    >
                      Add interval
                    </Button>
                  )}
              </div>
            ))}
        </fieldset>
      ))}
      <FormError error={error} />
      <Button type="submit" disabled={busy}>
        Save weekly schedule
      </Button>
    </form>
  );
}

function Exceptions({ pitch, date }: { pitch: Pitch; date: string }) {
  const { run, busy, error } = useManagementRequest();
  const [closed, setClosed] = useState(true);
  const base = `/api/owner/pitches/${pitch.id}/exceptions`;
  return (
    <div className="grid gap-4">
      <ul className="grid gap-2">
        {pitch.exceptions.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
          >
            <span>
              <strong>{dayString(item.date)}</strong> ·{" "}
              {item.isClosed
                ? "Closed"
                : `${minutesToClock(item.openingTime ?? 0)}–${minutesToClock(item.closingTime ?? 0)}`}{" "}
              · {item.reason}
            </span>
            <ConfirmAction
              label="Remove exception"
              description="Restore ordinary operating hours for this date."
              path={`${base}/${item.id}`}
              method="DELETE"
              success="Exception removed."
            />
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          const data = formValues(event);
          void run(
            () =>
              venueRequest(base, "POST", {
                date: value(data, "date"),
                reason: value(data, "reason"),
                isClosed: closed,
                openingTime: closed ? null : fromClock(value(data, "open")),
                closingTime: closed
                  ? null
                  : fromClock(value(data, "close")) || 1440,
              }),
            "Exception added.",
          );
        }}
      >
        <TextField
          label="Exception date"
          name="date"
          type="date"
          defaultValue={date}
          required
        />
        <TextField
          label="Reason"
          name="reason"
          minLength={2}
          maxLength={240}
          required
        />
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={closed}
            onChange={(e) => setClosed(e.target.checked)}
          />{" "}
          Closed for the day
        </label>
        {!closed && (
          <div className="grid gap-2 sm:grid-cols-2">
            <TextField
              label="Special opening"
              name="open"
              type="time"
              required
            />
            <TextField
              label="Special closing"
              name="close"
              type="time"
              required
            />
          </div>
        )}
        <FormError error={error} />
        <Button type="submit" disabled={busy}>
          Add exception
        </Button>
      </form>
    </div>
  );
}

function PricingEditor({ pitch }: { pitch: Pitch }) {
  type Rule = Pitch["pricingRules"][number];
  const [editId, setEditId] = useState<string>();
  const rule = pitch.pricingRules.find((item) => item.id === editId);
  const { run, busy, error } = useManagementRequest();
  const router = useRouter();
  function fields(current?: Rule) {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Rule name"
            name="name"
            required
            minLength={2}
            maxLength={70}
            defaultValue={current?.name}
          />
          <FormField label="Rule type">
            <select
              name="ruleType"
              defaultValue={current?.ruleType}
              className={choiceClass}
            >
              {Object.values(PricingRuleType).map((item) => (
                <option key={item} value={item}>
                  {human(item)}
                </option>
              ))}
            </select>
          </FormField>
          <TextField
            label="Hourly price (₹)"
            name="price"
            type="number"
            min="0"
            step="0.01"
            max="100000"
            required
            defaultValue={current ? current.pricePerHour / 100 : undefined}
          />
          <TextField
            label="Priority"
            name="priority"
            type="number"
            min="-1000"
            max="1000"
            defaultValue={current?.priority ?? 0}
            required
          />
          <TextField
            label="Start time (optional)"
            name="startTime"
            type="time"
            defaultValue={
              current?.startTime == null ? "" : editClock(current.startTime, "")
            }
          />
          <TextField
            label="End time (optional)"
            name="endTime"
            type="time"
            defaultValue={
              current?.endTime == null ? "" : editClock(current.endTime, "")
            }
          />
          <TextField
            label="Effective from"
            name="from"
            type="date"
            defaultValue={
              current?.effectiveFrom
                ? dayString(current.effectiveFrom)
                : undefined
            }
          />
          <TextField
            label="Effective until"
            name="until"
            type="date"
            defaultValue={
              current?.effectiveUntil
                ? dayString(current.effectiveUntil)
                : undefined
            }
          />
        </div>
        <fieldset className="flex flex-wrap gap-3 py-2 text-sm">
          <legend className="mb-2 font-bold">Days of week (optional)</legend>
          {weekdayNames.map((day, index) => (
            <label key={day} className="flex items-center gap-1.5">
              <input
                name="day"
                type="checkbox"
                value={index}
                defaultChecked={current?.daysOfWeek.includes(index)}
              />
              {day.slice(0, 3)}
            </label>
          ))}
        </fieldset>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name="active"
            defaultChecked={current?.isActive ?? true}
          />{" "}
          Active rule
        </label>
      </>
    );
  }
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">
        The highest-priority matching rule sets the hourly rate. With no match,
        the pitch uses its base rate.
      </p>
      <ul className="grid gap-2">
        {pitch.pricingRules.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap justify-between gap-2 rounded-xl border border-border p-3"
          >
            <div>
              <strong>{item.name}</strong>
              <p className="text-sm text-muted">
                {human(item.ruleType)} · {money(item.pricePerHour)} / hour ·
                Priority {item.priority} ·{" "}
                {item.isActive ? "Active" : "Inactive"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditId(item.id)}
              >
                Edit rule
              </Button>
              <ConfirmAction
                label="Remove rule"
                description="Future available slots will be repriced."
                path={`/api/owner/pricing/${item.id}`}
                method="DELETE"
                success="Rule removed."
              />
            </div>
          </li>
        ))}
      </ul>
      <form
        key={editId ?? "create"}
        className="grid gap-3"
        onSubmit={(event) => {
          const data = formValues(event);
          const start = nullable(data, "startTime"),
            end = nullable(data, "endTime");
          const payload = {
            name: value(data, "name"),
            ruleType: value(data, "ruleType"),
            pricePerHour: Math.round(number(data, "price") * 100),
            priority: number(data, "priority"),
            daysOfWeek: data.getAll("day").map(Number),
            startTime: start ? fromClock(start) : null,
            endTime: end ? fromClock(end) || 1440 : null,
            effectiveFrom: nullable(data, "from"),
            effectiveUntil: nullable(data, "until"),
            isActive: data.has("active"),
          };
          void run(
            () =>
              venueRequest(
                rule
                  ? `/api/owner/pricing/${rule.id}`
                  : `/api/owner/pitches/${pitch.id}/pricing`,
                rule ? "PATCH" : "POST",
                payload,
              ),
            rule ? "Pricing rule saved." : "Pricing rule added.",
            () => {
              setEditId(undefined);
              router.refresh();
            },
          );
        }}
      >
        <h3 className="text-lg font-bold">
          {rule ? `Edit ${rule.name}` : "Add pricing rule"}
        </h3>
        {fields(rule)}
        <FormError error={error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {rule ? "Save rule" : "Add rule"}
          </Button>
          {rule && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditId(undefined)}
            >
              Cancel editing
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Maintenance({
  pitch,
  slots,
  date,
  timezone,
  href,
  now,
}: {
  pitch: Pitch;
  slots: Slot[];
  date: string;
  timezone: string;
  href: string;
  now: number;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const { run, busy, error } = useManagementRequest();
  const router = useRouter();
  const base = `/api/owner/pitches/${pitch.id}/slots`;
  const active = slots.filter((slot) => selected.includes(slot.id));
  const selectedAvailable = active
    .filter((slot) => slot.status === "AVAILABLE")
    .map((slot) => slot.id);
  const selectedBlocked = active
    .filter((slot) => slot.status === "BLOCKED")
    .map((slot) => slot.id);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <form action={href} className="flex flex-wrap items-end gap-2">
          <TextField
            label="Maintenance date"
            name="date"
            type="date"
            defaultValue={date}
            required
          />
          <Button type="submit" variant="outline">
            Show slots
          </Button>
        </form>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(
              () => venueRequest(`${base}/generate`, "POST"),
              "Availability refreshed.",
            )
          }
        >
          Refresh availability
        </Button>
      </div>
      <p className="text-sm text-muted">
        {timezone} · Select future slots to manage maintenance.
      </p>
      {slots.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => {
            const selectable =
              (slot.status === "AVAILABLE" || slot.status === "BLOCKED") &&
              +new Date(slot.startAt) >= now;
            return (
              <li key={slot.id}>
                <label className="flex min-h-16 items-center gap-2 rounded-xl border border-border p-3 text-sm">
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={selected.includes(slot.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, slot.id]
                            : ids.filter((id) => id !== slot.id),
                        )
                      }
                    />
                  )}
                  <span>
                    <strong>
                      {slotTime(slot.startAt, timezone)}–
                      {slotTime(slot.endAt, timezone)}
                    </strong>
                    <span className="block text-muted">
                      {slotLabel[slot.status]} · {money(slot.price)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl bg-background p-4 text-sm text-muted">
          There are no slots on this date.
        </p>
      )}
      <FormError error={error} />
      <div className="flex flex-wrap gap-2">
        {!!selectedAvailable.length && (
          <ConfirmAction
            label="Block selected slots"
            description="Players will see these slots as maintenance."
            path={`${base}/block`}
            payload={{ slotIds: selectedAvailable }}
            success="Slots blocked."
            onDone={() => {
              setSelected([]);
              router.refresh();
            }}
          />
        )}
        {!!selectedBlocked.length && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  venueRequest(`${base}/unblock`, "POST", {
                    slotIds: selectedBlocked,
                  }),
                "Slots unblocked.",
                () => {
                  setSelected([]);
                  router.refresh();
                },
              )
            }
          >
            Unblock selected slots
          </Button>
        )}
      </div>
    </div>
  );
}

export function PitchEditor({
  pitch,
  venueId,
  slots,
  date,
  timezone,
  href,
  now,
}: {
  pitch: Pitch;
  venueId: string;
  slots: Slot[];
  date: string;
  timezone: string;
  href: string;
  now: number;
}) {
  return (
    <div className="space-y-4">
      <details className={panelClass} open>
        <summary className="mb-4 cursor-pointer text-xl font-extrabold">
          Pitch details and booking limits
        </summary>
        <PitchForm pitch={pitch} venueId={venueId} />
        {pitch.isActive && (
          <div className="mt-4">
            <ConfirmAction
              label="Deactivate pitch"
              description="Remove this pitch from public availability while keeping its records."
              path={`/api/owner/pitches/${pitch.id}`}
              method="DELETE"
              success="Pitch deactivated."
            />
          </div>
        )}
      </details>
      <details className={panelClass}>
        <summary className="mb-4 cursor-pointer text-xl font-extrabold">
          Weekly operating hours
        </summary>
        <WeeklyForm pitch={pitch} />
      </details>
      <details className={panelClass}>
        <summary className="mb-4 cursor-pointer text-xl font-extrabold">
          Schedule exceptions
        </summary>
        <Exceptions pitch={pitch} date={date} />
      </details>
      <details className={panelClass}>
        <summary className="mb-4 cursor-pointer text-xl font-extrabold">
          Pricing rules <Badge>{pitch.pricingRules.length}</Badge>
        </summary>
        <PricingEditor pitch={pitch} />
      </details>
      <section className={panelClass}>
        <h2 className="mb-4 text-xl font-extrabold">
          Date-based availability and maintenance
        </h2>
        <Maintenance
          key={date}
          pitch={pitch}
          date={date}
          timezone={timezone}
          slots={slots}
          href={href}
          now={now}
        />
      </section>
    </div>
  );
}
