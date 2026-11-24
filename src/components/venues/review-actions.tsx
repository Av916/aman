"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ConfirmAction,
  FormError,
  FormField,
  choiceClass,
  formValues,
  useManagementRequest,
  value,
} from "./management-controls";
import { venueRequest } from "./api-client";

export function ReviewActions({ id, status }: { id: string; status: string }) {
  const [reject, setReject] = useState(false);
  const { run, busy, error } = useManagementRequest();
  const base = `/api/admin/venues/${id}`;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {status === "PENDING_APPROVAL" && (
          <>
            <ConfirmAction
              label="Approve venue"
              description="The owner will be able to publish the listing."
              path={`${base}/approve`}
              success="Venue approved."
            />
            <Button
              variant="outline"
              type="button"
              onClick={() => setReject(!reject)}
            >
              Reject venue
            </Button>
          </>
        )}
        {status === "APPROVED" && (
          <ConfirmAction
            label="Suspend venue"
            description="Hide this venue from public discovery."
            path={`${base}/suspend`}
            success="Venue suspended."
          />
        )}
        {status === "SUSPENDED" && (
          <ConfirmAction
            label="Restore venue"
            description="Restore approval so the owner can publish the listing again."
            path={`${base}/restore`}
            success="Venue restored."
          />
        )}
      </div>
      {status === "PENDING_APPROVAL" && reject && (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            const data = formValues(event);
            void run(
              () =>
                venueRequest(`${base}/reject`, "POST", {
                  reason: value(data, "reason"),
                }),
              "Venue rejected.",
            );
          }}
        >
          <FormField label="Rejection reason">
            <textarea
              className={`${choiceClass} min-h-24 p-3`}
              name="reason"
              required
              minLength={5}
              maxLength={500}
            />
          </FormField>
          <FormError error={error} />
          <Button type="submit" disabled={busy}>
            Confirm rejection
          </Button>
        </form>
      )}
    </div>
  );
}
