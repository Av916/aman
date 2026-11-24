"use client";
import { useState } from "react";
import { AddonPricingType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { venueRequest } from "@/components/venues/api-client";
import {
  ConfirmAction,
  FormError,
  FormField,
  TextField,
  choiceClass,
  formValues,
  number,
  useManagementRequest,
  value,
} from "@/components/venues/management-controls";
import { human, money } from "@/components/venues/format";
import type { venueAddons } from "@/modules/addons/service";

type Addons = Awaited<ReturnType<typeof venueAddons>>;
export function AddonEditor({
  venueId,
  addons,
}: {
  venueId: string;
  addons: Addons;
}) {
  const { error, run, busy } = useManagementRequest();
  const [edited, setEdited] = useState<string>();
  const addon = addons.find((item) => item.id === edited);
  const base = `/api/owner/venues/${venueId}/addons`;
  return (
    <section className="mt-6 grid gap-4 border-t border-border pt-5">
      <h3 className="text-xl font-extrabold">Equipment and services</h3>
      <ul className="grid gap-2">
        {addons.map((item) => (
          <li
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
            key={item.id}
          >
            <div>
              <strong>{item.name}</strong>{" "}
              <Badge>{item.isActive ? "Active" : "Inactive"}</Badge>
              <p className="text-sm text-muted">
                {money(item.price)} · {human(item.pricingType)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEdited(item.id)}>
                Edit
              </Button>
              {item.isActive && (
                <ConfirmAction
                  label="Deactivate add-on"
                  description="Hide this add-on from future reservations. Existing booking prices stay fixed."
                  path={`/api/owner/addons/${item.id}`}
                  method="DELETE"
                  success="Add-on deactivated."
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      <form
        key={edited ?? "new"}
        className="grid gap-3"
        onSubmit={(event) => {
          const fields = formValues(event);
          const data = {
            name: value(fields, "name"),
            description: value(fields, "description"),
            price: Math.round(number(fields, "price") * 100),
            pricingType: value(fields, "pricingType"),
            isActive: fields.has("active"),
          };
          void run(
            () =>
              venueRequest(
                addon ? `/api/owner/addons/${addon.id}` : base,
                addon ? "PATCH" : "POST",
                data,
              ),
            "Add-on saved.",
          );
        }}
      >
        <TextField
          name="name"
          label="Add-on name"
          defaultValue={addon?.name}
          minLength={2}
          maxLength={100}
          required
        />
        <TextField
          name="description"
          label="Description"
          defaultValue={addon?.description}
          maxLength={400}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField
            name="price"
            label="Price (₹)"
            type="number"
            min={0}
            step="0.01"
            max={100000}
            defaultValue={addon ? addon.price / 100 : undefined}
            required
          />
          <FormField label="Pricing type">
            <select
              name="pricingType"
              className={choiceClass}
              defaultValue={addon?.pricingType}
            >
              {Object.values(AddonPricingType).map((item) => (
                <option key={item} value={item}>
                  {human(item)}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="active"
            defaultChecked={addon?.isActive ?? true}
          />{" "}
          Active add-on
        </label>
        <FormError error={error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {addon ? "Save add-on" : "Create add-on"}
          </Button>
          {edited && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEdited(undefined)}
            >
              Stop editing
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
