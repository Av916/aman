"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { venueRequest } from "@/components/venues/api-client";
import type { reservationDetail } from "@/modules/operations/queries";
import {
  ActionForm,
  Dialog,
  Field,
  formatMoney,
  formatTime,
  inputClass,
  type Json,
  LoadState,
  Status,
  paymentBadge,
  useOperation,
} from "./shared";

type Detail = Json<Awaited<ReturnType<typeof reservationDetail>>>;
export type Move = { id: string; pitchId: string; slots?: string[] };

export function BookingDetails({
  id,
  onClose,
  onChange,
  onMove,
}: {
  id: string;
  onClose: () => void;
  onChange: () => void;
  onMove?: (move: Move) => void;
}) {
  const base = `/api/owner/bookings/${id}`;
  const { data, error, reload } = useOperation<{ booking: Detail }>(base);
  const booking = data?.booking;
  const [operation, setOperation] = useState("");
  const update = () => {
    reload();
    onChange();
    setOperation("");
  };
  if (!booking)
    return (
      <Dialog title="Reservation details" onClose={onClose}>
        <LoadState error={error} />
      </Dialog>
    );
  const active =
    booking.status === "CONFIRMED" || booking.status === "CHECKED_IN";
  return (
    <Dialog title={booking.bookingNumber} onClose={onClose}>
      <div className="mb-5 grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Status value={booking.status} />
          <Status value={paymentBadge(booking)} />
          <Status value={booking.bookingSource} />
        </div>
        <p className="font-semibold">
          {booking.customerName} · {booking.pitchName}
        </p>
        <p className="text-sm text-muted">
          {formatTime(booking.startAt, booking.timezone, true)} to{" "}
          {formatTime(booking.endAt, booking.timezone)} ·{" "}
          {booking.durationMinutes} min
        </p>
        <p className="font-bold">{formatMoney(booking.totalAmount)}</p>
        {booking.addons.map((item) => (
          <p key={item.nameSnapshot} className="text-sm">
            {item.nameSnapshot} × {item.quantity} ·{" "}
            {formatMoney(item.totalPrice)}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {booking.status === "CONFIRMED" && (
          <Button variant="outline" onClick={() => setOperation("check-in")}>
            Check in
          </Button>
        )}
        {active && (
          <Button
            variant="outline"
            onClick={() =>
              setOperation(
                booking.status === "CHECKED_IN" ? "complete" : "no-show",
              )
            }
          >
            {booking.status === "CHECKED_IN"
              ? "Mark completed"
              : "Mark no-show"}
          </Button>
        )}
        {booking.bookingSource !== "ONLINE" &&
          !booking.confirmedPayment &&
          !booking._count.allocations &&
          active && (
            <Button
              variant="outline"
              onClick={() => setOperation("record-payment")}
            >
              Record payment
            </Button>
          )}
        {["CONFIRMED", "PENDING_PAYMENT"].includes(booking.status) && (
          <Button variant="outline" onClick={() => setOperation("cancel")}>
            Cancel reservation
          </Button>
        )}
        {booking.status === "CONFIRMED" && onMove && (
          <Button
            variant="outline"
            onClick={() => onMove({ id, pitchId: booking.pitchId })}
          >
            Reschedule
          </Button>
        )}
        {booking.confirmedPayment && (
          <Button variant="outline" onClick={() => setOperation("refund")}>
            Request refund
          </Button>
        )}
        {booking.status === "CONFIRMED" && (
          <Button variant="outline" onClick={() => setOperation("resend")}>
            Resend confirmation
          </Button>
        )}
        {(booking.confirmedPayment || booking._count.allocations > 0) && (
          <Button asChild variant="outline">
            <Link href={base + "/receipt"}>Download receipt</Link>
          </Button>
        )}
      </div>
      {operation && (
        <div className="mt-5 border-t border-border pt-5">
          {operation === "cancel" ? (
            <CancellationForm base={base} onChange={update} />
          ) : (
            <ActionForm
              key={operation}
              label={
                operation === "refund"
                  ? "Reserve refund"
                  : operation === "record-payment"
                    ? "Confirm offline payment"
                    : "Confirm action"
              }
              submit={async (form) => {
                const body =
                  operation === "record-payment"
                    ? { method: form.get("method") }
                    : operation === "refund"
                      ? {
                          amount: Math.round(Number(form.get("amount")) * 100),
                          reason: form.get("reason"),
                        }
                      : {};
                await venueRequest(base + "/" + operation, "POST", body, {
                  "Idempotency-Key": crypto.randomUUID(),
                });
                update();
              }}
            >
              {operation === "record-payment" && (
                <Field label="Payment method">
                  <select name="method" className={inputClass}>
                    {offlineMethods.map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {operation === "refund" && (
                <>
                  <Field label="Refund amount in rupees">
                    <input
                      name="amount"
                      type="number"
                      min=".01"
                      step=".01"
                      required
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Reason">
                    <input
                      name="reason"
                      minLength={5}
                      maxLength={300}
                      required
                      className={inputClass}
                    />
                  </Field>
                </>
              )}
              {operation === "check-in" && (
                <p className="text-sm text-muted">
                  Confirm the customer’s identity before recording a manual
                  check-in.
                </p>
              )}
            </ActionForm>
          )}
        </div>
      )}
    </Dialog>
  );
}

export const offlineMethods = [
  ["CASH", "Cash"],
  ["UPI_OFFLINE", "Offline UPI"],
  ["CARD_OFFLINE", "Offline card"],
  ["BANK_TRANSFER", "Bank transfer"],
];

export function CancellationForm({
  base,
  onChange,
}: {
  base: string;
  onChange: () => void;
}) {
  const [quote, setQuote] = useState<{
    refundAmount: number;
    nonRefundableAmount: number;
  }>();
  return quote ? (
    <ActionForm
      label="Confirm cancellation"
      submit={async (form) => {
        await venueRequest(base + "/cancel", "POST", {
          expectedRefundAmount: quote.refundAmount,
          reason: form.get("reason"),
          confirmed: true,
          ...(form.get("cause") ? { cause: form.get("cause") } : {}),
        });
        onChange();
      }}
    >
      <p className="text-sm">
        Refund <b>{formatMoney(quote.refundAmount)}</b> · Non-refundable{" "}
        <b>{formatMoney(quote.nonRefundableAmount)}</b>
      </p>
      {base.startsWith("/api/owner/") && (
        <Field label="Cause">
          <select name="cause" className={inputClass}>
            <option value="">Operator cancellation</option>
            <option value="WEATHER">Weather</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </Field>
      )}
      <Field label="Cancellation reason">
        <textarea
          name="reason"
          className={inputClass}
          required
          minLength={5}
          maxLength={300}
        />
      </Field>
    </ActionForm>
  ) : (
    <ActionForm
      label="Review cancellation quote"
      submit={async () => {
        setQuote(await venueRequest(base + "/cancellation-quote", "POST", {}));
      }}
    />
  );
}
