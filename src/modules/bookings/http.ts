import { readBody } from "@/lib/api";
import { roleRoute, query, json } from "@/modules/venues/http";
import { publicQuote } from "@/modules/pricing/pricing.service";
import {
  calendarForCustomer,
  receiptForCustomer,
} from "@/modules/receipts/service";
import { bookingList, bookingView } from "./booking.repository";
import {
  createBooking,
  expireBooking,
  releaseBooking,
  saveCheckout,
} from "./booking.service";
import { holdExpired } from "./booking.state-machine";
import {
  bookingListQuery,
  checkoutInput,
  createBookingInput,
  idempotencyKeySchema,
  selection,
} from "./booking.validation";

type Id = { id: string };
export const quotePost = roleRoute("CUSTOMER", async (r, who) =>
  json("Quote calculated.", {
    quote: await publicQuote(await readBody(r, selection), who),
  }),
);
export const bookingPost = roleRoute("CUSTOMER", async (r, who) => {
  const key = idempotencyKeySchema.parse(r.headers.get("idempotency-key"));
  const { booking, replay } = await createBooking(
    who,
    await readBody(r, createBookingInput),
    key,
  );
  return json(
    replay ? "Existing reservation loaded." : "Reservation held.",
    { booking },
    replay ? 200 : 201,
  );
});
export const bookingsGet = roleRoute("CUSTOMER", async (r, who) => {
  const { status, page } = query(r, bookingListQuery);
  return json("Bookings loaded.", await bookingList(who, status, page));
});
export async function currentBooking(id: string, who: string) {
  const booking = await bookingView(id, who);
  if (
    booking.status !== "PENDING_PAYMENT" ||
    !holdExpired(booking.holdExpiresAt)
  )
    return booking;
  await expireBooking(id, who);
  return bookingView(id, who);
}
export const bookingGet = roleRoute<Id>("CUSTOMER", async (_r, who, { id }) =>
  json("Booking loaded.", { booking: await currentBooking(id, who) }),
);
export const bookingPatch = roleRoute<Id>("CUSTOMER", async (r, who, { id }) =>
  json("Checkout details saved.", {
    booking: await saveCheckout(id, who, await readBody(r, checkoutInput)).then(
      () => bookingView(id, who),
    ),
  }),
);
export const bookingStatusGet = roleRoute<Id>(
  "CUSTOMER",
  async (_r, who, { id }) => {
    const booking = await currentBooking(id, who);
    return json("Booking status loaded.", {
      status: booking.status,
      paymentStatus:
        booking.confirmedPayment?.status ?? booking.payments[0]?.status ?? null,
      holdExpiresAt: booking.holdExpiresAt,
      refunds: booking.refunds,
    });
  },
);
export const releasePost = roleRoute<Id>("CUSTOMER", async (_r, who, { id }) =>
  json("Reservation released.", {
    booking: await releaseBooking(id, who).then(() => bookingView(id, who)),
  }),
);
export const receiptGet = roleRoute<Id>("CUSTOMER", async (_r, who, { id }) => {
  const receipt = await receiptForCustomer(id, who);
  return new Response(new Uint8Array(receipt.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${receipt.reference}.pdf"`,
    },
  });
});
export const calendarGet = roleRoute<Id>(
  "CUSTOMER",
  async (_r, who, { id }) =>
    new Response(await calendarForCustomer(id, who), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="pitchmate.ics"',
      },
    }),
);
