import {
  changeFee,
  feeSetting,
  changeAccountStatus,
  reviewOwner,
} from "@/modules/admin/operations";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  AppError,
  assertSameOrigin,
  endpoint,
  readBody,
  success,
} from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { query } from "@/modules/venues/http";
import { limitAttempt } from "@/modules/auth/rate-limit";
import {
  requireVenueAccess,
  venueScope,
  type Actor,
} from "@/modules/permissions/operations";
import {
  createBookingInput,
  idempotencyKeySchema,
  selection,
} from "@/modules/bookings/booking.validation";
import {
  attendance,
  createManualBooking,
  issueCheckInToken,
  manualInput,
  offlineMethod,
  operationalQuote,
  recordOfflinePayment,
  tokenHash,
  lockOperationalBooking,
} from "./bookings";
import {
  calendar,
  operationQuery,
  operationVenues,
  reservationDetail,
  reservationList,
} from "./queries";
import { changeSlotBlock } from "./maintenance";
import {
  activatePolicy,
  cancellationQuote,
  cancelBooking,
  createPolicy,
} from "@/modules/cancellations/service";
import { policyInput } from "@/modules/cancellations/policy";
import {
  adjustmentInput,
  listRefunds,
  manualRefund,
  retryRefund,
  settleOfflineRefund,
} from "@/modules/finance/operations";
import { analytics } from "@/modules/finance/analytics";
import { csvReport, reportKind, reportRows } from "@/modules/finance/reports";
import {
  acceptStaff,
  assignedVenues,
  invitationInput,
  inviteStaff,
  staffList,
  staffUpdate,
  updateStaff,
} from "@/modules/staff/service";
import { customers } from "./customers";
import {
  couponInput,
  deactivateCoupon,
  listCoupons,
  saveCoupon,
} from "@/modules/coupons/service";
import {
  editReview,
  moderateReview,
  publicReviews,
  reasonInput,
  reportReview,
  respondReview,
  reviewInput,
  submitReview,
} from "@/modules/reviews/service";
import { publicQuote } from "@/modules/pricing/pricing.service";
import {
  rescheduleBooking,
  rescheduleQuote,
} from "@/modules/rescheduling/service";
import { generateReceipt } from "@/modules/receipts/service";
import {
  bookingAudit,
  transaction,
} from "@/modules/bookings/booking.repository";
import { notify } from "@/modules/notifications/service";

const uuid = z.uuid();
const reason = z.strictObject({ reason: reasonInput });
const token = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);
const cancellationInput = reason.extend({
  expectedRefundAmount: z.number().int().nonnegative(),
  confirmed: z.literal(true),
  cause: z.enum(["WEATHER", "MAINTENANCE", "EMERGENCY"]).optional(),
});
const key = (request: Request) =>
  idempotencyKeySchema.parse(request.headers.get("idempotency-key"));
type Handler<P> = (
  request: Request,
  actor: Actor,
  params: P,
) => Promise<Response>;
export function operationRoute<
  P extends Record<string, string> = Record<string, never>,
>(action: Handler<P>, role?: "CUSTOMER" | "ADMIN") {
  return endpoint(async (r: Request, context: { params: Promise<P> }) => {
    const actor = await requireUser();
    if (role && actor.role !== role)
      throw new AppError(
        403,
        "FORBIDDEN",
        "This operation requires a different account role.",
      );
    const params = (await context?.params) ?? ({} as P);
    for (const id of Object.values(params)) uuid.parse(id);
    if (r.method !== "GET") {
      assertSameOrigin(r);
      await limitAttempt("operations-mutation", r.headers, actor.id, {
        global: 6000,
        ip: 180,
        identity: 120,
      });
    }
    return action(r, actor, params);
  });
}

const attendanceView = (booking: Awaited<ReturnType<typeof attendance>>) => ({
  id: booking.id,
  bookingNumber: booking.bookingNumber,
  status: booking.status,
});
const reply = (data: object, status = 200) =>
  success("Operation completed.", data, status);
const q = (r: Request) => query(r, operationQuery);
type Id = { id: string };
export const venuesGet = operationRoute(async (_r, actor) =>
  reply({ venues: await operationVenues(actor) }),
);
export const calendarGet = operationRoute(async (r, actor) =>
  reply(await calendar(actor, q(r))),
);
export const bookingListGet = operationRoute(async (r, actor) =>
  reply(await reservationList(actor, q(r))),
);
export const bookingGet = operationRoute<Id>(async (_r, actor, { id }) =>
  reply({ booking: await reservationDetail(actor, id) }),
);
export const quotePost = operationRoute(async (r, actor) =>
  reply({ quote: await operationalQuote(actor, await readBody(r, selection)) }),
);
export const manualPost = operationRoute(async (r, actor) =>
  reply(
    {
      booking: await createManualBooking(
        actor,
        await readBody(r, manualInput),
        key(r),
      ),
    },
    201,
  ),
);
export const collectPost = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    payment: await recordOfflinePayment(
      actor,
      id,
      (await readBody(r, z.strictObject({ method: offlineMethod }))).method,
    ),
  }),
);
export const checkInPost = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    booking: attendanceView(
      await attendance(
        actor,
        id,
        "CHECKED_IN",
        (await readBody(r, z.strictObject({ token: token.optional() }))).token,
      ),
    ),
  }),
);
export const completePost = operationRoute<Id>(async (_r, actor, { id }) =>
  reply({ booking: attendanceView(await attendance(actor, id, "COMPLETED")) }),
);
export const noShowPost = operationRoute<Id>(async (_r, actor, { id }) =>
  reply({ booking: attendanceView(await attendance(actor, id, "NO_SHOW")) }),
);
export const tokenCheckInPost = operationRoute(async (r, actor) => {
  const value = (await readBody(r, z.strictObject({ token }))).token;
  const row = await getPrisma().checkInToken.findFirst({
    where: {
      tokenHash: tokenHash(value),
      usedAt: null,
      expiresAt: { gt: new Date() },
      booking: { venue: venueScope(actor, "attend") },
    },
    select: { bookingId: true },
  });
  if (!row)
    throw new AppError(
      404,
      "TOKEN_NOT_FOUND",
      "No eligible booking matches this token.",
    );
  return reply({
    booking: attendanceView(
      await attendance(actor, row.bookingId, "CHECKED_IN", value),
    ),
  });
});
export const tokenGet = operationRoute<Id>(async (r, actor, { id }) => {
  const site = r.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site")
    throw new AppError(
      403,
      "ORIGIN_REJECTED",
      "Open this booking from PitchMate.",
    );
  await limitAttempt("check-in-token", r.headers, actor.id, {
    global: 3000,
    ip: 120,
    identity: 20,
  });
  return reply(await issueCheckInToken(actor, id));
}, "CUSTOMER");
export const blockPost = operationRoute<Id>(async (r, actor, { id }) => {
  await changeSlotBlock(
    actor,
    id,
    await readBody(r, reason.extend({ block: z.boolean() })),
  );
  return reply({});
});
export const operatorCancelQuote = operationRoute<Id>(
  async (_r, actor, { id }) => reply(await cancellationQuote(actor, id, true)),
);
export const operatorCancel = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    cancellation: await cancelBooking(
      actor,
      id,
      await readBody(r, cancellationInput),
      true,
    ),
  }),
);
export const customerCancelQuote = operationRoute<Id>(
  async (_r, actor, { id }) => reply(await cancellationQuote(actor, id)),
  "CUSTOMER",
);
export const customerCancel = operationRoute<Id>(
  async (r, actor, { id }) =>
    reply({
      cancellation: await cancelBooking(
        actor,
        id,
        await readBody(r, cancellationInput),
      ),
    }),
  "CUSTOMER",
);
export const customerRefunds = operationRoute<Id>(async (_r, actor, { id }) => {
  const booking = await getPrisma().booking.findFirst({
    where: { id, customerId: actor.id },
    select: {
      refunds: {
        select: {
          id: true,
          amount: true,
          status: true,
          reason: true,
          createdAt: true,
          processedAt: true,
        },
      },
    },
  });
  if (!booking)
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  return reply(booking);
}, "CUSTOMER");
export const operatorRescheduleQuote = operationRoute<Id>(
  async (r, actor, { id }) =>
    reply(await rescheduleQuote(actor, id, await readBody(r, selection), true)),
);
export const operatorReschedule = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    request: await rescheduleBooking(
      actor,
      id,
      await readBody(r, createBookingInput),
      true,
    ),
  }),
);
export const customerRescheduleQuote = operationRoute<Id>(
  async (r, actor, { id }) =>
    reply(await rescheduleQuote(actor, id, await readBody(r, selection))),
  "CUSTOMER",
);
export const customerReschedule = operationRoute<Id>(
  async (r, actor, { id }) =>
    reply({
      request: await rescheduleBooking(
        actor,
        id,
        await readBody(r, createBookingInput),
      ),
    }),
  "CUSTOMER",
);
export const policiesGet = operationRoute<Id>(async (_r, actor, { id }) => {
  const db = getPrisma();
  await requireVenueAccess(db, actor, id, "policies");
  return reply({
    policies: await db.cancellationPolicy.findMany({
      where: { venueId: id },
      include: { rules: true },
      orderBy: { version: "desc" },
      take: 50,
    }),
  });
});
export const policiesPost = operationRoute<Id>(async (r, actor, { id }) =>
  reply(
    { policy: await createPolicy(actor, id, await readBody(r, policyInput)) },
    201,
  ),
);
export const policyPatch = operationRoute<Id>(async (r, actor, { id }) => {
  const { venueId } = await getPrisma().cancellationPolicy.findUniqueOrThrow({
    where: { id },
    select: { venueId: true },
  });
  return reply(
    {
      policy: await createPolicy(
        actor,
        venueId,
        await readBody(r, policyInput),
      ),
    },
    201,
  );
});
export const policyActivate = operationRoute<Id>(async (_r, actor, { id }) =>
  reply({ policy: await activatePolicy(actor, id) }),
);
export const analyticsGet = operationRoute(async (r, actor) =>
  reply(await analytics(actor, q(r))),
);
export const refundsGet = operationRoute(async (r, actor) =>
  reply({ refunds: await listRefunds(actor, q(r)) }),
);
export const refundGet = operationRoute<Id>(async (r, actor, { id }) =>
  reply({ refund: (await listRefunds(actor, q(r), id))[0] }),
);
export const refundAdjustment = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    refund: await manualRefund(
      actor,
      id,
      await readBody(r, adjustmentInput),
      key(r),
    ),
  }),
);
export const refundApprove = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    refund: await settleOfflineRefund(
      actor,
      id,
      (
        await readBody(
          r,
          z.strictObject({ reference: z.string().trim().min(3).max(100) }),
        )
      ).reference,
    ),
  }),
);
export const adminRefunds = operationRoute(
  async (r, actor) => reply({ refunds: await listRefunds(actor, q(r)) }),
  "ADMIN",
);
export const adminRefund = operationRoute<Id>(
  async (r, actor, { id }) =>
    reply({ refund: (await listRefunds(actor, q(r), id))[0] }),
  "ADMIN",
);
export const adminRefundRetry = operationRoute<Id>(
  async (r, actor, { id }) =>
    reply({
      refund: await retryRefund(actor, id, (await readBody(r, reason)).reason),
    }),
  "ADMIN",
);
export const staffGet = operationRoute(async (_r, actor) =>
  reply(await staffList(actor)),
);
export const staffInvite = operationRoute(async (r, actor) =>
  reply(
    {
      invitation: await inviteStaff(actor, await readBody(r, invitationInput)),
    },
    201,
  ),
);
export const staffAccept = operationRoute(async (r, actor) =>
  reply({
    staff: await acceptStaff(
      actor,
      (await readBody(r, z.strictObject({ token }))).token,
    ),
  }),
);
export const staffPatch = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    staff: await updateStaff(actor, id, await readBody(r, staffUpdate)),
  }),
);
export const staffRemove = operationRoute<Id>(async (_r, actor, { id }) =>
  reply({ staff: await updateStaff(actor, id, { status: "REMOVED" }) }),
);
export const staffAssign = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    staff: await updateStaff(
      actor,
      id,
      {},
      (await readBody(r, z.strictObject({ venueIds: assignedVenues })))
        .venueIds,
    ),
  }),
);
export const customersGet = operationRoute(async (r, actor) =>
  reply(await customers(actor, q(r))),
);
export const customerGet = operationRoute<Id>(async (r, actor, { id }) =>
  reply(await customers(actor, q(r), id)),
);
export const publicReviewGet = endpoint(
  async (r: Request, { params }: { params: Promise<{ slug: string }> }) =>
    reply(
      await publicReviews(
        z
          .string()
          .max(150)
          .parse((await params).slug),
        q(r).page,
      ),
    ),
);
export const reviewPost = operationRoute<Id>(
  async (r, actor, { id }) =>
    reply(
      { review: await submitReview(actor, id, await readBody(r, reviewInput)) },
      201,
    ),
  "CUSTOMER",
);
export const reviewPatch = operationRoute<Id>(
  async (r, actor, { id }) =>
    reply(await editReview(actor, id, await readBody(r, reviewInput))),
  "CUSTOMER",
);
export const reviewReport = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    report: await reportReview(actor, id, (await readBody(r, reason)).reason),
  }),
);
export const reviewRespond = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    review: await respondReview(
      actor,
      id,
      (
        await readBody(
          r,
          z.strictObject({ response: z.string().trim().min(2).max(1200) }),
        )
      ).response,
    ),
  }),
);
export const reviewModerate = operationRoute<Id>(async (r, actor, { id }) => {
  const input = await readBody(
    r,
    reason.extend({ status: z.enum(["PUBLISHED", "HIDDEN", "REJECTED"]) }),
  );
  return reply({
    review: await moderateReview(actor, id, input.status, input.reason),
  });
}, "ADMIN");
export const validateCoupon = operationRoute(
  async (r, actor) =>
    reply({
      quote: await publicQuote(
        await readBody(r, selection.required({ couponCode: true })),
        actor.id,
      ),
    }),
  "CUSTOMER",
);
export const couponList = operationRoute(async (_r, actor) =>
  reply({ coupons: await listCoupons(actor) }),
);
export const adminCouponList = operationRoute(
  async (_r, actor) => reply({ coupons: await listCoupons(actor, true) }),
  "ADMIN",
);
export const couponCreate = operationRoute(async (r, actor) =>
  reply(
    { coupon: await saveCoupon(actor, await readBody(r, couponInput)) },
    201,
  ),
);
export const couponPatch = operationRoute<Id>(async (r, actor, { id }) =>
  reply({
    coupon: await saveCoupon(actor, await readBody(r, couponInput), id),
  }),
);
export const couponRemove = operationRoute<Id>(async (_r, actor, { id }) =>
  reply({ coupon: await deactivateCoupon(actor, id) }),
);
const requestedReport = (r: Request) =>
  reportKind
    .default("bookings")
    .parse(new URL(r.url).searchParams.get("kind") ?? undefined);
export const reportsGet = operationRoute(async (r, actor) =>
  reply({
    rows: (await reportRows(actor, requestedReport(r), q(r))).slice(0, 26),
  }),
);
export const adminReportsGet = operationRoute(
  async (r, actor) =>
    reply({
      rows: (await reportRows(actor, requestedReport(r), q(r))).slice(0, 26),
    }),
  "ADMIN",
);
function exportRoute(admin = false) {
  return operationRoute(
    async (r, actor) => {
      await limitAttempt("csv-export", r.headers, actor.id);
      const kind = requestedReport(r);
      const csv = await csvReport(actor, kind, q(r));
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pitchmate-${kind}.csv"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    },
    admin ? "ADMIN" : undefined,
  );
}
export const exportGet = exportRoute();
export const adminExportGet = exportRoute(true);
export const reportBookings = operationRoute(async (r, actor) =>
  reply({ rows: (await reportRows(actor, "bookings", q(r))).slice(0, 26) }),
);
export const reportRevenue = operationRoute(async (r, actor) =>
  reply({ rows: (await reportRows(actor, "revenue", q(r))).slice(0, 26) }),
);
export const reportOccupancy = operationRoute(async (r, actor) =>
  reply({ rows: (await reportRows(actor, "occupancy", q(r))).slice(0, 26) }),
);
export const resendBooking = operationRoute<Id>(async (_r, actor, { id }) => {
  await transaction(async (tx) => {
    const { booking } = await lockOperationalBooking(tx, actor, id, "reserve");
    if (booking.status !== "CONFIRMED")
      throw new AppError(
        409,
        "BOOKING_NOT_CONFIRMED",
        "Confirm the booking before resending.",
      );
    const stamp = Math.floor(Date.now() / 900_000);
    await notify(tx, booking, "BOOKING_CONFIRMED", `resend:${stamp}`);
    await bookingAudit(tx, booking, "CONFIRMATION_RESENT", undefined, actor.id);
  });
  return reply({});
});
export const operatorReceipt = operationRoute<Id>(async (_r, actor, { id }) => {
  const target = await getPrisma().booking.findFirst({
    where: { id, venue: venueScope(actor, "collect") },
    select: { id: true },
  });
  if (!target)
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  const receipt = await generateReceipt(id);
  return new Response(new Uint8Array(receipt.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receipt.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
export const adminCouponCreate = operationRoute(async (r, actor) => {
  const input = await readBody(r, couponInput);
  if (input.venueId !== null)
    throw new AppError(
      422,
      "PLATFORM_COUPON",
      "Use the platform dashboard for platform-wide coupons.",
    );
  return reply({ coupon: await saveCoupon(actor, input) }, 201);
}, "ADMIN");

async function reviewList(r: Request, actor: Actor) {
  const db = getPrisma();
  const { page, venueId } = q(r);
  return reply({
    reviews: await db.review.findMany({
      where: { venueId, booking: { venue: venueScope(actor, "reviews") } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 25,
      skip: (page - 1) * 25,
      include: {
        booking: { select: { venueName: true } },
        _count: { select: { reports: true } },
      },
    }),
  });
}
export const ownerReviewList = operationRoute(reviewList);
export const adminReviewList = operationRoute(reviewList, "ADMIN");

export const adminSettingsGet = operationRoute(
  async () => reply({ fee: await feeSetting() }),
  "ADMIN",
);
export const adminSettingsPatch = operationRoute(async (r, actor) => {
  const input = await readBody(
    r,
    reason.extend({ amount: z.number().int().min(0).max(1_000_000) }),
  );
  return reply({ entry: await changeFee(actor, input.amount, input.reason) });
}, "ADMIN");
export const adminStatusPatch = operationRoute<Id>(async (r, actor, { id }) => {
  const input = await readBody(
    r,
    reason.extend({ status: z.enum(["ACTIVE", "SUSPENDED"]) }),
  );
  return reply({
    account: await changeAccountStatus(actor, id, input.status, input.reason),
  });
}, "ADMIN");
export const adminOwnerPatch = operationRoute<Id>(async (r, actor, { id }) => {
  const input = await readBody(
    r,
    reason.extend({ status: z.enum(["APPROVED", "REJECTED"]) }),
  );
  return reply({
    owner: await reviewOwner(actor, id, input.status, input.reason),
  });
}, "ADMIN");

export const adminCouponPatch = operationRoute<Id>(async (r, actor, { id }) => {
  const input = await readBody(r, couponInput);
  if (input.venueId !== null)
    throw new AppError(
      422,
      "PLATFORM_COUPON",
      "Use the platform dashboard for platform-wide coupons.",
    );
  return reply({ coupon: await saveCoupon(actor, input, id) });
}, "ADMIN");
export const adminCouponRemove = operationRoute<Id>(
  async (_r, actor, { id }) => {
    const row = await getPrisma().coupon.findFirst({
      where: { id, venueId: null },
    });
    if (!row)
      throw new AppError(404, "COUPON_NOT_FOUND", "Platform coupon not found.");
    return reply({ coupon: await deactivateCoupon(actor, id) });
  },
  "ADMIN",
);
