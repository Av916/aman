"use client";

import { PolicyTerms } from "@/components/operations/customer-booking";
import { readPolicy } from "@/modules/cancellations/policy";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clock, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { venueRequest } from "@/components/venues/api-client";
import { money } from "@/components/venues/format";
import type { BookingView } from "@/modules/bookings/booking.repository";

type GatewayReply = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  handler: (data: GatewayReply) => void;
  modal: { ondismiss: () => void };
  retry: { enabled: boolean };
};
type RazorpayCheckout = new (options: CheckoutOptions) => {
  open(): void;
  on(event: "payment.failed", action: () => void): void;
};
let checkoutScript: Promise<RazorpayCheckout> | undefined;
function loadCheckout() {
  const lookup = () =>
    (window as Window & { Razorpay?: RazorpayCheckout }).Razorpay;
  if (lookup()) return Promise.resolve(lookup()!);
  if (!checkoutScript)
    checkoutScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error("Secure checkout could not load. Please retry."));
      }, 10_000);
      function finish() {
        clearTimeout(timer);
        const checkout = lookup();
        if (checkout) resolve(checkout);
        else {
          script.remove();
          reject(new Error("Secure checkout could not load. Please retry."));
        }
      }
      script.onload = finish;
      script.onerror = finish;
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      checkoutScript = undefined;
      throw error;
    }) as Promise<RazorpayCheckout>;
  return checkoutScript;
}

const field = "grid min-w-0 gap-1 text-sm font-bold";
const summaryPath = (id: string) => `/bookings/${id}/confirmation`;

export function CheckoutForm({
  booking,
  startedAt,
  ready,
}: {
  booking: BookingView;
  startedAt: number;
  ready: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState(startedAt);
  const [state, setState] = useState<
    "idle" | "order" | "verification" | "releasing"
  >("idle");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [release, setRelease] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const wentOffline = () => setOffline(true);
    const reconnected = () => {
      setOffline(false);
      router.refresh();
    };
    window.addEventListener("offline", wentOffline);
    window.addEventListener("online", reconnected);
    if (!navigator.onLine) wentOffline();
    return () => {
      window.removeEventListener("offline", wentOffline);
      window.removeEventListener("online", reconnected);
    };
  }, [router]);
  const remaining = Math.max(
    0,
    Math.ceil((+new Date(booking.holdExpiresAt) - now) / 1000),
  );
  const timedOut = !remaining;
  const details = [
    "customerName",
    "customerEmail",
    "customerPhone",
    "customerNotes",
  ] as const;
  const processing = state !== "idle";

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (offline) return;
    const form = new FormData(event.currentTarget);
    const saveOnly =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "save";
    setState("order");
    setError("");
    const input = {
      ...Object.fromEntries(
        details.map((key) => [key, String(form.get(key) ?? "")]),
      ),
      playerCount: Number(form.get("playerCount")),
      termsAccepted: form.has("termsAccepted"),
    } as Record<(typeof details)[number], string> & {
      playerCount: number;
      termsAccepted: boolean;
    };
    try {
      if (saveOnly) {
        await venueRequest(`/api/bookings/${booking.id}`, "PATCH", input);
        setState("idle");
        router.refresh();
        return;
      }
      const order = await venueRequest<{
        key: string;
        orderId: string;
        amount: number;
        currency: string;
      }>("/api/payments/create-order", "POST", {
        bookingId: booking.id,
        ...input,
      });
      const Razorpay = await loadCheckout();
      const checkout = new Razorpay({
        key: order.key,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "PitchMate",
        description: booking.bookingNumber,
        prefill: {
          name: input.customerName,
          email: input.customerEmail,
          contact: input.customerPhone,
        },
        retry: { enabled: true },
        modal: { ondismiss: () => setState("idle") },
        handler: async (result) => {
          setState("verification");
          try {
            await venueRequest("/api/payments/verify", "POST", {
              bookingId: booking.id,
              ...result,
            });
            router.push(summaryPath(booking.id));
          } catch (problem) {
            setState("idle");
            setError(
              problem instanceof Error
                ? problem.message
                : "Payment is being reconciled.",
            );
          }
        },
      });
      checkout.on("payment.failed", () =>
        setError("Payment failed. You can retry while the hold is active."),
      );
      checkout.open();
    } catch (problem) {
      setState("idle");
      setError(
        problem instanceof Error ? problem.message : "Could not start payment.",
      );
    }
  }
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-highlight px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Clock size={16} aria-hidden /> Hold remaining
        </span>
        <strong aria-hidden className="text-lg tabular-nums">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </strong>
        <span className="sr-only" role="status">
          {timedOut
            ? "Hold expired"
            : `${Math.ceil(remaining / 60)} minutes remaining`}
        </span>
      </div>
      <h2 className="mb-4 text-2xl font-extrabold">Customer information</h2>
      <form className="grid gap-4" onSubmit={pay}>
        <label className={field}>
          Full name
          <Input
            name="customerName"
            defaultValue={booking.customerName}
            autoComplete="name"
            required
            maxLength={80}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={field}>
            Contact email
            <Input
              name="customerEmail"
              defaultValue={booking.customerEmail ?? ""}
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <div className="rounded-lg border border-border p-3">
            <PolicyTerms
              policy={readPolicy(booking.cancellationPolicySnapshot)}
            />
          </div>
          <label className={field}>
            Phone number
            <Input
              name="customerPhone"
              defaultValue={booking.customerPhone ?? ""}
              type="tel"
              autoComplete="tel"
              required
            />
          </label>
        </div>
        <label className={field}>
          Player count
          <Input
            name="playerCount"
            type="number"
            min={1}
            max={booking.pitch.capacity}
            defaultValue={booking.playerCount}
            required
          />
        </label>
        <label className={field}>
          Notes for the venue (optional)
          <textarea
            name="customerNotes"
            className="min-h-24 rounded-xl border border-control-border bg-surface px-3 py-2"
            maxLength={500}
            defaultValue={booking.customerNotes ?? ""}
          />
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
          <input
            className="mt-1"
            name="termsAccepted"
            type="checkbox"
            required
            defaultChecked={!!booking.termsAcceptedAt}
          />
          <span>
            I understand that my hold expires at the displayed deadline and the
            booking is confirmed after PitchMate verifies the captured payment.
          </span>
        </label>
        {!ready && (
          <p role="status" className="text-sm text-muted">
            Online payment is unavailable in this environment.
          </p>
        )}
        {timedOut && (
          <p role="alert" className="text-sm text-destructive">
            Your hold ended. Visit your booking to see its current status.
          </p>
        )}
        {offline && (
          <p
            role="status"
            className="rounded-lg border border-border bg-surface p-3 text-sm"
          >
            You’re offline. Reconnect to check payment status before trying
            again.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <div className="sticky bottom-0 z-10 grid gap-2 border-t border-border bg-surface py-3 lg:static">
          <Button
            type="submit"
            disabled={offline || timedOut || processing || !ready}
            size="lg"
          >
            <LockKeyhole size={17} aria-hidden />
            {state === "verification"
              ? "Verifying payment…"
              : state === "order"
                ? "Opening secure checkout…"
                : `Pay ${money(booking.settlementDue ?? booking.totalAmount)}`}
          </Button>
          <Button
            type="submit"
            value="save"
            variant="outline"
            disabled={offline || timedOut || processing}
          >
            Save contact details
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(summaryPath(booking.id))}
          >
            View booking status
          </Button>
        </div>
      </form>
      {!timedOut && !processing && (
        <div className="mt-3">
          {!release ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRelease(true)}
            >
              Release unpaid hold
            </Button>
          ) : (
            <div
              role="group"
              aria-label="Confirm release"
              className="rounded-xl border border-border p-3"
            >
              <p className="mb-2 text-sm text-muted">
                The selected slots will return to availability.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setRelease(false)}>
                  Keep hold
                </Button>
                <Button
                  onClick={async () => {
                    setState("releasing");
                    try {
                      await venueRequest(
                        `/api/bookings/${booking.id}/release`,
                        "POST",
                      );
                      router.push(summaryPath(booking.id));
                    } catch (problem) {
                      setError(
                        problem instanceof Error
                          ? problem.message
                          : "Could not release the hold.",
                      );
                      setState("idle");
                    }
                  }}
                >
                  Confirm release
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
