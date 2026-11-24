"use client";

import { useState } from "react";
import { venueRequest } from "@/components/venues/api-client";
import { Button } from "@/components/ui/button";
import {
  ActionForm,
  Dialog,
  Field,
  inputClass,
  LoadState,
  panelClass,
  readable,
  SimpleTable,
  useOperation,
} from "./shared";

type Row = {
  id: string;
  rating: number;
  comment: string | null;
  status: string;
  ownerResponse: string | null;
  booking: { venueName: string };
  _count: { reports: number };
};
export function ReviewWorkspace({ admin }: { admin: boolean }) {
  const base = `/api/${admin ? "admin" : "owner"}/reviews`;
  const [page, setPage] = useState(1);
  const [row, setRow] = useState<Row>();
  const state = useOperation<{ reviews: Row[] }>(`${base}?page=${page}`);
  return (
    <div className="grid gap-4">
      {!state.data ? (
        <LoadState error={state.error} />
      ) : (
        <SimpleTable
          columns={[
            "Venue",
            "Rating",
            "Comment",
            "Status",
            "Reports",
            "Action",
          ]}
          rows={state.data.reviews.map((item) => [
            item.booking.venueName,
            `${item.rating}/5`,
            item.comment,
            readable(item.status),
            item._count.reports,
            <button
              key="manage"
              className="underline"
              onClick={() => setRow(item)}
            >
              {admin ? "Moderate" : "Reply"}
            </button>,
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
          disabled={!state.data || state.data.reviews.length < 25}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      {row && (
        <Dialog
          title={admin ? "Moderate review" : "Respond to review"}
          onClose={() => setRow(undefined)}
        >
          <p className="mb-3">{row.comment}</p>
          <ActionForm
            submit={async (form) => {
              await venueRequest(
                `${base}/${row.id}/${admin ? "moderate" : "respond"}`,
                "POST",
                admin
                  ? { status: form.get("status"), reason: form.get("reason") }
                  : { response: form.get("response") },
              );
              setRow(undefined);
              state.reload();
            }}
          >
            {admin ? (
              <>
                <Field label="Review status">
                  <select
                    name="status"
                    className={inputClass}
                    defaultValue={row.status}
                  >
                    <option>PUBLISHED</option>
                    <option>HIDDEN</option>
                    <option>REJECTED</option>
                  </select>
                </Field>
                <Field label="Reason">
                  <input
                    name="reason"
                    className={inputClass}
                    required
                    minLength={5}
                    maxLength={300}
                  />
                </Field>
              </>
            ) : (
              <Field label="Public response">
                <textarea
                  name="response"
                  className={inputClass}
                  required
                  minLength={2}
                  maxLength={1200}
                  defaultValue={row.ownerResponse ?? ""}
                />
              </Field>
            )}
          </ActionForm>
        </Dialog>
      )}
    </div>
  );
}

export function PublicReviewReport({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <Dialog title="Report review" onClose={() => setOpen(false)}>
      <ActionForm
        label="Send report"
        submit={async (form) => {
          await venueRequest(`/api/reviews/${id}/report`, "POST", {
            reason: form.get("reason"),
          });
          setOpen(false);
        }}
      >
        <Field label="Reason">
          <input
            name="reason"
            className={inputClass}
            required
            minLength={5}
            maxLength={300}
          />
        </Field>
      </ActionForm>
    </Dialog>
  ) : (
    <button
      onClick={() => setOpen(true)}
      className="text-xs text-muted underline"
    >
      Report
    </button>
  );
}

export function BookingReviewForm({
  bookingId,
  existing,
}: {
  bookingId: string;
  existing: {
    id: string;
    rating: number;
    comment: string | null;
    status: string;
  } | null;
}) {
  const [review, setReview] = useState(existing);
  return (
    <section className={panelClass}>
      <h2 className="mb-3 font-bold">
        {review ? "Your verified review" : "Review your booking"}
      </h2>
      {review && review.status !== "PUBLISHED" ? (
        <p>{readable(review.status)}</p>
      ) : (
        <ActionForm
          label={review ? "Update review" : "Publish review"}
          submit={async (form) => {
            const payload = {
              rating: Number(form.get("rating")),
              comment: String(form.get("comment")),
            };
            if (review) {
              await venueRequest(`/api/reviews/${review.id}`, "PATCH", payload);
              setReview({ ...review, ...payload });
            } else {
              const { review: saved } = await venueRequest<{
                review: NonNullable<typeof existing>;
              }>(`/api/bookings/${bookingId}/review`, "POST", payload);
              setReview(saved);
            }
          }}
        >
          <Field label="Rating">
            <select
              name="rating"
              className={inputClass}
              defaultValue={review?.rating ?? 5}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} out of 5
                </option>
              ))}
            </select>
          </Field>
          <Field label="Optional comments">
            <textarea
              name="comment"
              maxLength={1200}
              className={inputClass}
              defaultValue={review?.comment ?? ""}
            />
          </Field>
        </ActionForm>
      )}
    </section>
  );
}
