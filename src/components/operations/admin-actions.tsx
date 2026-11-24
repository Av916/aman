"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { venueRequest } from "@/components/venues/api-client";
import { ActionForm, Dialog, Field, inputClass, panelClass } from "./shared";

export function AdminAccountAction({
  id,
  mode,
  current,
}: {
  id: string;
  mode: "users" | "owners";
  current: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return open ? (
    <Dialog
      title={
        mode === "users" ? "Update account access" : "Review owner verification"
      }
      onClose={() => setOpen(false)}
    >
      <ActionForm
        submit={async (form) => {
          await venueRequest(`/api/admin/${mode}/${id}`, "PATCH", {
            status: form.get("status"),
            reason: form.get("reason"),
          });
          setOpen(false);
          router.refresh();
        }}
      >
        <Field label="New status">
          <select className={inputClass} name="status" defaultValue={current}>
            {(mode === "users"
              ? ["ACTIVE", "SUSPENDED"]
              : ["APPROVED", "REJECTED"]
            ).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Reason">
          <input
            name="reason"
            required
            minLength={5}
            maxLength={300}
            className={inputClass}
          />
        </Field>
      </ActionForm>
    </Dialog>
  ) : (
    <Button variant="outline" onClick={() => setOpen(true)}>
      Manage
    </Button>
  );
}

export function FeeSettings({ amount }: { amount: number }) {
  return (
    <section className={panelClass}>
      <ActionForm
        submit={async (form) => {
          await venueRequest("/api/admin/settings", "PATCH", {
            amount: Number(form.get("amount")),
            reason: form.get("reason"),
          });
        }}
        label="Update fee"
      >
        <Field label="Platform fee in paise">
          <input
            type="number"
            name="amount"
            className={inputClass}
            min={0}
            max={1000000}
            defaultValue={amount}
            required
          />
        </Field>
        <Field label="Reason">
          <input
            name="reason"
            required
            minLength={5}
            maxLength={300}
            className={inputClass}
          />
        </Field>
      </ActionForm>
    </section>
  );
}
