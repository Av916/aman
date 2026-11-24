"use client";
import { useRouter } from "next/navigation";
import { ActionForm, Field, inputClass } from "./shared";
import { venueRequest } from "@/components/venues/api-client";

export function SystemRecovery({
  id,
  action,
}: {
  id: string;
  action: "retry-job" | "retry-outbox" | "reconcile-order";
}) {
  const router = useRouter();
  return (
    <details>
      <summary className="cursor-pointer font-semibold underline">
        Recovery options
      </summary>
      <ActionForm
        label="Confirm recovery"
        submit={async (form) => {
          await venueRequest("/api/admin/system/recover", "POST", {
            id,
            action,
            confirmed: form.get("confirmed") === "on",
            reason: form.get("reason"),
          });
          router.refresh();
        }}
      >
        <Field label="Audit reason">
          <input
            name="reason"
            minLength={5}
            maxLength={300}
            required
            className={inputClass}
          />
        </Field>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="confirmed" required /> I confirm this
          recovery action
        </label>
      </ActionForm>
    </details>
  );
}
