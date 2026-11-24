"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { venueRequest } from "@/components/venues/api-client";
import type { BookingView } from "@/modules/bookings/booking.repository";
import type { readPolicy } from "@/modules/cancellations/policy";
import {
  ActionForm,
  Field,
  formatMoney,
  formatTime,
  inputClass,
  LoadState,
  panelClass,
  Status,
  useOperation,
} from "./shared";
import { CancellationForm } from "./booking-actions";
import { BookingReviewForm } from "./review-workspace";

export function PolicyTerms({
  policy,
}: {
  policy: ReturnType<typeof readPolicy>;
}) {
  return (
    <details>
      <summary className="cursor-pointer text-sm font-bold">
        {policy.name}
      </summary>
      <p className="my-2 text-sm text-muted">{policy.description}</p>
      <ul className="grid gap-1 text-sm">
        {[...policy.rules]
          .sort(
            (a, b) => b.minimumHoursBeforeBooking - a.minimumHoursBeforeBooking,
          )
          .map((rule) => (
            <li key={rule.minimumHoursBeforeBooking}>
              {rule.minimumHoursBeforeBooking}+ hours before start ·{" "}
              {rule.refundPercentage}% of eligible payment
            </li>
          ))}
      </ul>
    </details>
  );
}

export function CustomerBookingActions({
  booking,
  policy,
}: {
  booking: BookingView;
  policy: ReturnType<typeof readPolicy>;
}) {
  const router = useRouter();
  const [action, setAction] = useState("");
  const [token, setToken] = useState<{ token: string; expiresAt: string }>();
  const base = `/api/bookings/${booking.id}`;
  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-5 pb-12">
      <div className={panelClass}>
        <PolicyTerms policy={policy} />
      </div>
      {booking.replacements[0] && (
        <p className={panelClass}>
          Replacement reservation{" "}
          <Link
            className="font-bold underline"
            href={`/bookings/${booking.replacements[0].id}`}
          >
            {booking.replacements[0].bookingNumber}
          </Link>
          .
        </p>
      )}
      {booking.status === "CONFIRMED" && (
        <section className={panelClass}>
          <h2 className="mb-3 text-lg font-bold">Manage reservation</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setAction(action === "cancel" ? "" : "cancel")}
            >
              Cancel reservation
            </Button>
            {!booking.rescheduledFromId && (
              <Button
                variant="outline"
                onClick={() => setAction(action === "move" ? "" : "move")}
              >
                Reschedule
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setAction(action === "token" ? "" : "token")}
            >
              Check-in token
            </Button>
          </div>
          <div className={action ? "mt-4" : ""}>
            {action === "cancel" && (
              <CancellationForm
                base={base}
                onChange={() => {
                  setAction("");
                  router.refresh();
                }}
              />
            )}
            {action === "move" && <CustomerMove booking={booking} />}
            {action === "token" &&
              (token ? (
                <div>
                  <p className="text-sm">
                    Show this token to reception. Expires{" "}
                    {formatTime(token.expiresAt, booking.timezone)}.
                  </p>
                  <code className="break-all text-lg">{token.token}</code>
                </div>
              ) : (
                <ActionForm
                  label="Generate check-in token"
                  submit={async () =>
                    setToken(await venueRequest(base + "/check-in-token"))
                  }
                />
              ))}
          </div>
        </section>
      )}
      {booking.refunds.length > 0 && (
        <section className={panelClass}>
          <h2 className="mb-3 text-lg font-bold">Refund activity</h2>
          <ul className="grid gap-2">
            {booking.refunds.map((refund) => (
              <li
                key={refund.id}
                className="flex flex-wrap items-center gap-3 text-sm"
              >
                <Status value={refund.status} />
                <strong>{formatMoney(refund.amount)}</strong>
                <span>{refund.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {booking.status === "COMPLETED" && (
        <BookingReviewForm bookingId={booking.id} existing={booking.review} />
      )}
    </div>
  );
}
type Available = {
  slots: { id: string; startAt: string; endAt: string; status: string }[];
};
type MoveQuote = {
  quote: { fingerprint: string };
  originalAmount: number;
  replacementAmount: number;
  priceDifference: number;
  amountDue: number;
};
function CustomerMove({ booking }: { booking: BookingView }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [quote, setQuote] = useState<MoveQuote>();
  const state = useOperation<Available>(
    date ? `/api/pitches/${booking.pitchId}/availability?date=${date}` : "",
  );
  const base = `/api/bookings/${booking.id}`;
  return (
    <ActionForm
      disabled={!ids.length}
      label={quote ? "Confirm replacement" : "Review replacement price"}
      submit={async () => {
        const selection = {
          pitchId: booking.pitchId,
          slotIds: ids,
          addons: [],
        };
        if (!quote)
          return setQuote(
            await venueRequest(base + "/reschedule-quote", "POST", selection),
          );
        const { request } = await venueRequest<{
          request: { status: string; replacementBookingId: string };
        }>(base + "/reschedule", "POST", {
          ...selection,
          quoteFingerprint: quote.quote.fingerprint,
        });
        router.push(
          request.status === "AWAITING_PAYMENT"
            ? `/checkout/${request.replacementBookingId}`
            : `/bookings/${request.replacementBookingId}`,
        );
      }}
    >
      <Field label="New date">
        <input
          type="date"
          className={inputClass}
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setIds([]);
            setQuote(undefined);
          }}
        />
      </Field>
      {date &&
        (!state.data ? (
          <LoadState error={state.error} />
        ) : (
          <fieldset className="flex max-h-44 flex-wrap gap-3 overflow-auto">
            <legend className="mb-2 text-sm font-bold">
              New consecutive slots
            </legend>
            {state.data.slots
              .filter(
                (item) =>
                  item.status === "AVAILABLE" ||
                  booking.items.some((slot) => slot.originalSlotId === item.id),
              )
              .map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={ids.includes(item.id)}
                    onChange={(event) => {
                      setIds(
                        event.target.checked
                          ? [...ids, item.id]
                          : ids.filter((id) => id !== item.id),
                      );
                      setQuote(undefined);
                    }}
                  />
                  {formatTime(item.startAt, booking.timezone)}
                </label>
              ))}
            {!state.data.slots.length && (
              <p className="text-sm">No slots on this date.</p>
            )}
          </fieldset>
        ))}
      {quote && (
        <p className="text-sm">
          Replacement price {formatMoney(quote.replacementAmount)} · Difference{" "}
          {formatMoney(quote.priceDifference)}
        </p>
      )}
    </ActionForm>
  );
}
