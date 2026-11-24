import {
  createManualBooking,
  attendance,
  issueCheckInToken,
  recordOfflinePayment,
} from "@/modules/operations/bookings";
import {
  activatePolicy,
  cancelBooking,
  cancellationQuote,
  createPolicy,
} from "@/modules/cancellations/service";
import {
  manualRefund,
  settleOfflineRefund,
} from "@/modules/finance/operations";
import { analytics } from "@/modules/finance/analytics";
import { csvReport } from "@/modules/finance/reports";
import { calendar, operationQuery } from "@/modules/operations/queries";
import { inviteStaff, acceptStaff, updateStaff } from "@/modules/staff/service";
import {
  rescheduleBooking,
  rescheduleQuote,
} from "@/modules/rescheduling/service";
import { publicReviews, submitReview } from "@/modules/reviews/service";
import { saveCoupon } from "@/modules/coupons/service";
import { changeSlotBlock } from "@/modules/operations/maintenance";
import { recordRefund } from "@/modules/payments/refund.service";
import { remindBookings } from "@/modules/jobs/service";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import { publicQuote } from "@/modules/pricing/pricing.service";
import {
  createBooking,
  expireBooking,
  releaseBooking,
  saveCheckout,
} from "@/modules/bookings/booking.service";
import { bookingView } from "@/modules/bookings/booking.repository";
import {
  startPayment,
  processProviderPayment,
  verifyCheckout,
} from "@/modules/payments/payment.service";
import type {
  PaymentGateway,
  ProviderPayment,
  ProviderOrder,
  ProviderRefund,
} from "@/modules/payments/payment.provider";
import {
  persistWebhook,
  processWebhook,
} from "@/modules/payments/webhook.service";
import { processOutbox, reconcilePayments } from "@/modules/jobs/service";
import { receiptForCustomer } from "@/modules/receipts/service";
import { generateOwnerSlots } from "@/modules/pitches/service";
import {
  atVenueTime,
  dayOfWeek,
  localDay,
  shiftDay,
} from "@/modules/schedules/time";
import { pitchAvailability } from "@/modules/availability/service";

const databaseUrl = process.env.TEST_DATABASE_URL;
const zone = "Asia/Kolkata";
const day = shiftDay(localDay(new Date(), zone), 1);
const secret = "isolated-payment-test-secret";
const sign = (body: string) =>
  createHmac("sha256", secret).update(body).digest("hex");
const contact = {
  customerName: "Riya Player",
  customerEmail: "riya@example.test",
  customerPhone: "+91 98765 43210",
  playerCount: 8,
  customerNotes: "",
  termsAccepted: true as const,
};
const token = () => randomUUID().replaceAll("-", "");

function stub() {
  const orders = new Map<string, ProviderOrder>();
  const payments = new Map<string, ProviderPayment>();
  const refunds = new Map<string, ProviderRefund>();
  let ambiguous = false;
  let creates = 0;
  const provider: PaymentGateway = {
    async createOrder(input) {
      creates++;
      const order: ProviderOrder = {
        ...input,
        id: `order_${token()}`,
        status: "created",
      };
      orders.set(order.id, order);
      if (ambiguous) throw new Error("lost provider response");
      return order;
    },
    async findOrder(receipt) {
      return [...orders.values()].find((order) => order.receipt === receipt);
    },
    async getPayment(id) {
      const payment = payments.get(id);
      if (!payment) throw new Error("Missing test payment");
      return payment;
    },
    async orderPayments(id) {
      return [...payments.values()].filter(
        (payment) => payment.order_id === id,
      );
    },
    async createRefund(id, amount, key) {
      const existing = refunds.get(key);
      if (existing) return existing;
      const refund: ProviderRefund = {
        id: `rfnd_${token()}`,
        payment_id: id,
        amount,
        receipt: key,
        status: "processed",
      };
      refunds.set(key, refund);
      return refund;
    },
    async getRefund(id) {
      const refund = [...refunds.values()].find((item) => item.id === id);
      if (!refund) throw new Error("Missing test refund");
      return refund;
    },
  };
  function capture(
    order: { providerOrderId: string | null; amount: number; currency: string },
    amount = order.amount,
  ) {
    const charge: ProviderPayment = {
      id: `pay_${token()}`,
      order_id: order.providerOrderId!,
      amount,
      currency: order.currency,
      status: "captured",
      captured: true,
      method: "upi",
    };
    payments.set(charge.id, charge);
    return charge;
  }
  return {
    provider,
    capture,
    refunds,
    payments,
    failResponse: () => {
      ambiguous = true;
    },
    creates: () => creates,
  };
}

describe.skipIf(!databaseUrl)(
  "PostgreSQL reservation and payment invariants",
  () => {
    let ownerId: string;
    let customers: string[];
    beforeAll(async () => {
      if (!databaseUrl || databaseUrl === process.env.DATABASE_URL)
        throw new Error("Use a separate migrated test database.");
      process.env.DATABASE_URL = databaseUrl;
      process.env.RAZORPAY_KEY_SECRET = secret;
      process.env.RAZORPAY_WEBHOOK_SECRET = secret;
      process.env.RAZORPAY_KEY_ID = "rzp_test_pitchmate";
      const db = getPrisma();
      const owner = await db.user.create({
        data: {
          email: `${token()}@example.test`,
          name: "Fixture Owner",
          role: "OWNER",
        },
      });
      ownerId = owner.id;
      customers = (
        await db.user.createManyAndReturn({
          data: Array.from({ length: 100 }, () => ({
            email: `${token()}@example.test`,
            name: "Fixture Customer",
            role: "CUSTOMER" as const,
            emailVerified: new Date(),
          })),
          select: { id: true },
        })
      ).map((item) => item.id);
    });
    afterAll(() => getPrisma().$disconnect());

    async function market() {
      const db = getPrisma();
      const venue = await db.venue.create({
        data: {
          ownerId,
          name: "Local Fixture",
          slug: `booking-${token()}`,
          city: "Delhi",
          address: "Fixture Road",
          timezone: zone,
          status: "APPROVED",
          publishedAt: new Date(),
          pitches: {
            create: [
              {
                name: "Main pitch",
                pitchType: "BOX_CRICKET",
                surfaceType: "ARTIFICIAL_TURF",
                lengthInMeters: 40,
                widthInMeters: 24,
                capacity: 12,
                basePrice: 90000,
                slotDurationMinutes: 30,
                minimumBookingMinutes: 30,
                hours: {
                  create: [
                    {
                      dayOfWeek: dayOfWeek(day),
                      openingTime: 600,
                      closingTime: 720,
                    },
                  ],
                },
              },
            ],
          },
          addons: {
            create: [
              { name: "Cricket bat", price: 20000, pricingType: "PER_BOOKING" },
            ],
          },
        },
        include: { pitches: true, addons: true },
      });
      const pitchId = venue.pitches[0].id;
      await generateOwnerSlots(ownerId, pitchId);
      const availabilityStart = performance.now();
      const { slots } = await pitchAvailability(pitchId, day);
      const availabilityMs = performance.now() - availabilityStart;
      expect(slots).toHaveLength(4);
      return {
        venue,
        pitchId,
        ids: slots.map((slot) => slot.id),
        availabilityMs,
      };
    }
    async function selectionFor(
      pitchId: string,
      slotIds: string[],
      addons: { addonId: string; quantity: number }[] = [],
    ) {
      const input = { pitchId, slotIds, addons };
      return {
        ...input,
        quoteFingerprint: (await publicQuote(input)).fingerprint,
      };
    }
    async function orderFor(
      customerId: string,
      bookingId: string,
      gateway = stub(),
    ) {
      await startPayment(customerId, bookingId, contact, gateway.provider);
      const order = await getPrisma().paymentOrder.findUniqueOrThrow({
        where: { bookingId },
      });
      return { order, gateway };
    }
    async function forceExpiry(id: string) {
      await getPrisma().booking.update({
        where: { id },
        data: { holdExpiresAt: new Date(Date.now() - 1000) },
      });
    }

    const operator = () => ({ id: ownerId, role: "OWNER" as const });
    const player = (index: number) => ({
      id: customers[index],
      role: "CUSTOMER" as const,
    });
    async function manualSelection(
      pitchId: string,
      slotIds: string[],
      paid = true,
    ) {
      return {
        ...(await selectionFor(pitchId, slotIds)),
        playerCount: 6,
        source: "WALK_IN" as const,
        paymentMethod: paid ? ("CASH" as const) : ("UNPAID" as const),
        identity: {
          type: "guest" as const,
          name: "Walk-in Cricketer",
          phone: "+91 98765 43210",
        },
      };
    }
    async function verifyOwner() {
      await getPrisma().ownerProfile.upsert({
        where: { userId: ownerId },
        update: { verificationStatus: "APPROVED" },
        create: {
          userId: ownerId,
          businessName: "Fixture",
          businessPhone: "+91 9876543210",
          verificationStatus: "APPROVED",
        },
      });
    }
    async function receptionist(venueId: string, index: number) {
      const db = getPrisma();
      const user = await db.user.findUniqueOrThrow({
        where: { id: customers[index] },
      });
      const actor = { ...player(index), email: user.email };
      const invite = await inviteStaff(operator(), {
        email: user.email,
        role: "RECEPTIONIST",
        venueIds: [venueId],
      });
      const email = await db.outboxEvent.findFirstOrThrow({
        where: { aggregateId: invite.id, eventType: "OPERATIONAL_EMAIL" },
      });
      const code = (email.payload as { text: string }).text.split("#").at(-1)!;
      const staff = await acceptStaff(actor, code);
      await expect(acceptStaff(actor, code)).rejects.toMatchObject({
        code: "INVITATION_NOT_FOUND",
      });
      return { actor, staff };
    }

    it("shares inventory across online customers and a receptionist and enforces venue assignments", async () => {
      await verifyOwner();
      const { venue, pitchId, ids } = await market();
      const other = await market();
      const { actor, staff } = await receptionist(venue.id, 40);
      await expect(
        calendar(actor, operationQuery.parse({ venueId: other.venue.id })),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        csvReport(
          actor,
          "revenue",
          operationQuery.parse({ venueId: venue.id }),
        ),
      ).rejects.toMatchObject({ status: 403 });
      const input = await manualSelection(pitchId, [ids[0]], false);
      const race = await Promise.allSettled([
        createManualBooking(actor, input, token()),
        createBooking(customers[41], input, token()),
      ]);
      expect(
        race.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      await updateStaff(operator(), staff.id, { status: "SUSPENDED" });
      await expect(
        calendar(actor, operationQuery.parse({ venueId: venue.id })),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("records one offline collection, cancels idempotently, settles manually and reports the ledger", async () => {
      await verifyOwner();
      const { venue, pitchId, ids } = await market();
      const db = getPrisma();
      const input = await manualSelection(pitchId, [ids[0]], false);
      const key = token();
      const booking = await createManualBooking(operator(), input, key);
      expect(booking.customerId).toBeNull();
      expect(booking.guestCustomerId).toBeTruthy();
      expect(booking.confirmedPaymentId).toBeNull();
      expect((await createManualBooking(operator(), input, key)).id).toBe(
        booking.id,
      );
      const [first, second] = await Promise.all([
        recordOfflinePayment(operator(), booking.id, "CASH"),
        recordOfflinePayment(operator(), booking.id, "CASH"),
      ]);
      expect(first.id).toBe(second.id);
      const quote = await cancellationQuote(operator(), booking.id, true);
      const cancellation = {
        expectedRefundAmount: quote.refundAmount,
        reason: "Severe weather closure",
        cause: "WEATHER" as const,
      };
      const [left, right] = await Promise.all([
        cancelBooking(operator(), booking.id, cancellation, true),
        cancelBooking(operator(), booking.id, cancellation, true),
      ]);
      expect(left.id).toBe(right.id);
      const refund = await db.refund.findFirstOrThrow({
        where: { bookingId: booking.id },
      });
      expect(refund.status).toBe("PENDING");
      await settleOfflineRefund(operator(), refund.id, "Cash receipt 15");
      const { venues } = await analytics(
        operator(),
        operationQuery.parse({ venueId: venue.id }),
      );
      expect(venues[0].revenues.OFFLINE_PAYMENT).toBe(first.amount);
      expect(venues[0].revenues.REFUND).toBe(first.amount);
      expect(venues[0].netCollected).toBe(0);
      expect(
        await csvReport(
          operator(),
          "refunds",
          operationQuery.parse({ venueId: venue.id }),
        ),
      ).toContain(booking.bookingNumber);
      expect(
        (await db.slot.findUnique({ where: { id: ids[0] } }))?.status,
      ).toBe("AVAILABLE");
    });

    it("holds an operator-initiated Razorpay reservation until the registered customer pays", async () => {
      await verifyOwner();
      const { pitchId, ids } = await market();
      const db = getPrisma();
      const customer = await db.user.findUniqueOrThrow({
        where: { id: customers[48] },
      });
      const created = await createManualBooking(
        operator(),
        {
          ...(await manualSelection(pitchId, [ids[0]])),
          paymentMethod: "RAZORPAY",
          identity: { type: "customer", email: customer.email },
        },
        token(),
      );
      expect(created.status).toBe("PENDING_PAYMENT");
      expect(
        (await db.slot.findUniqueOrThrow({ where: { id: ids[0] } })).status,
      ).toBe("HELD");
      expect(await db.payment.count({ where: { bookingId: created.id } })).toBe(
        0,
      );
      const { gateway, order } = await orderFor(customers[48], created.id);
      await processProviderPayment(order, gateway.capture(order));
      expect(
        (await db.booking.findUniqueOrThrow({ where: { id: created.id } }))
          .status,
      ).toBe("CONFIRMED");
    });

    it("snapshots policy versions and serializes partial refund reservations and replayed receipts", async () => {
      await verifyOwner();
      const { venue, pitchId, ids } = await market();
      const policy = await createPolicy(operator(), venue.id, {
        name: "Half refund",
        description: "Test policy",
        rules: [{ minimumHoursBeforeBooking: 0, refundPercentage: 50 }],
      });
      await activatePolicy(operator(), policy.id);
      const { booking } = await createBooking(
        customers[42],
        await selectionFor(pitchId, [ids[0]]),
        token(),
      );
      const { gateway, order } = await orderFor(customers[42], booking.id);
      const payment = gateway.capture(order);
      await processProviderPayment(order, payment);
      const newer = await createPolicy(operator(), venue.id, {
        name: "No refund",
        description: "Future bookings",
        rules: [{ minimumHoursBeforeBooking: 0, refundPercentage: 0 }],
      });
      await activatePolicy(operator(), newer.id);
      const quote = await cancellationQuote(player(42), booking.id);
      expect(quote.percentage).toBe(50);
      const competing = await Promise.allSettled(
        Array.from({ length: 3 }, () =>
          manualRefund(
            operator(),
            booking.id,
            {
              reason: "Authorized partial adjustment",
              amount: quote.refundAmount,
            },
            token(),
          ),
        ),
      );
      expect(
        competing.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(2);
      const first = competing.find((result) => result.status === "fulfilled");
      if (!first || first.status !== "fulfilled")
        throw Error("Expected a refund allocation.");
      const value = first.value;
      const observation = await gateway.provider.createRefund(
        payment.id,
        value.amount,
        value.id,
      );
      await Promise.all(
        Array.from({ length: 8 }, () => recordRefund(value.id, observation)),
      );
      const ledger = await getPrisma().financialTransaction.findMany({
        where: { refundId: value.id },
      });
      expect(ledger.map(({ amount }) => amount)).toEqual([value.amount]);
    });

    it("reschedules overlapping same-price slots without releasing shared inventory", async () => {
      await verifyOwner();
      const { pitchId, ids } = await market();
      const original = await createManualBooking(
        operator(),
        await manualSelection(pitchId, [ids[0], ids[1]]),
        token(),
      );
      const selection = { pitchId, slotIds: [ids[1], ids[2]], addons: [] };
      const quote = await rescheduleQuote(
        operator(),
        original.id,
        selection,
        true,
      );
      const moved = await rescheduleBooking(
        operator(),
        original.id,
        { ...selection, quoteFingerprint: quote.quote.fingerprint },
        true,
      );
      expect(moved.status).toBe("COMPLETED");
      const slots = await getPrisma().slot.findMany({
        where: { id: { in: [ids[0], ids[1], ids[2]] } },
        orderBy: { startAt: "asc" },
      });
      expect(slots.map((slot) => slot.activeBookingId)).toEqual([
        null,
        moved.replacementBookingId,
        moved.replacementBookingId,
      ]);
      expect(
        await getPrisma().financialTransaction.count({
          where: {
            bookingId: moved.replacementBookingId,
            transactionType: "OFFLINE_PAYMENT",
          },
        }),
      ).toBe(0);
    });

    it("keeps the original booking until a verified higher-price payment finalizes the replacement", async () => {
      await verifyOwner();
      const { pitchId, ids } = await market();
      const db = getPrisma();
      const { booking } = await createBooking(
        customers[43],
        await selectionFor(pitchId, [ids[0]]),
        token(),
      );
      const { gateway, order } = await orderFor(customers[43], booking.id);
      await processProviderPayment(order, gateway.capture(order));
      const selection = { pitchId, slotIds: [ids[0], ids[1]], addons: [] };
      const quote = await rescheduleQuote(player(43), booking.id, selection);
      const moved = await rescheduleBooking(player(43), booking.id, {
        ...selection,
        quoteFingerprint: quote.quote.fingerprint,
      });
      expect(moved.status).toBe("AWAITING_PAYMENT");
      expect(
        (await db.slot.findUniqueOrThrow({ where: { id: ids[0] } }))
          .activeBookingId,
      ).toBe(booking.id);
      const replacement = await orderFor(
        customers[43],
        moved.replacementBookingId,
        gateway,
      );
      expect(replacement.order.amount).toBe(quote.amountDue);
      await processProviderPayment(
        replacement.order,
        gateway.capture(replacement.order),
      );
      expect(
        (await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe("RESCHEDULED");
      expect(
        (await db.slot.findUniqueOrThrow({ where: { id: ids[0] } }))
          .activeBookingId,
      ).toBe(moved.replacementBookingId);
      expect(
        await db.paymentAllocation.count({
          where: { bookingId: moved.replacementBookingId },
        }),
      ).toBe(2);
    });

    it("compensates a cheaper move and preserves the original while competing for a destination slot", async () => {
      await verifyOwner();
      const { pitchId, ids } = await market();
      const offline = await createManualBooking(
        operator(),
        await manualSelection(pitchId, [ids[0], ids[1]]),
        token(),
      );
      const selection = { pitchId, slotIds: [ids[2]], addons: [] };
      const quote = await rescheduleQuote(
        operator(),
        offline.id,
        selection,
        true,
      );
      const online = await selectionFor(pitchId, [ids[2]]);
      const results = await Promise.allSettled([
        rescheduleBooking(
          operator(),
          offline.id,
          { ...selection, quoteFingerprint: quote.quote.fingerprint },
          true,
        ),
        createBooking(customers[59], online, token()),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const db = getPrisma();
      const original = await db.booking.findUniqueOrThrow({
        where: { id: offline.id },
      });
      if (results[0].status === "fulfilled") {
        expect(original.status).toBe("RESCHEDULED");
        const refund = await db.refund.findFirstOrThrow({
          where: { bookingId: offline.id },
        });
        expect(refund.amount).toBe(-quote.priceDifference);
      } else {
        expect(original.status).toBe("CONFIRMED");
        expect(
          (await db.slot.findUniqueOrThrow({ where: { id: ids[0] } }))
            .activeBookingId,
        ).toBe(offline.id);
      }

      const separate = await market();
      const source = await createManualBooking(
        operator(),
        await manualSelection(separate.pitchId, separate.ids.slice(0, 2)),
        token(),
      );
      const cheaper = {
        pitchId: separate.pitchId,
        slotIds: [separate.ids[2]],
        addons: [],
      };
      const less = await rescheduleQuote(operator(), source.id, cheaper, true);
      const moved = await rescheduleBooking(
        operator(),
        source.id,
        { ...cheaper, quoteFingerprint: less.quote.fingerprint },
        true,
      );
      const resizedRefund = await db.refund.findFirstOrThrow({
        where: { bookingId: source.id },
      });
      expect(resizedRefund.amount).toBe(-less.priceDifference);
      const cancellation = await cancellationQuote(
        operator(),
        moved.replacementBookingId,
        true,
      );
      expect(cancellation.refundAmount).toBe(less.replacementAmount);
      await cancelBooking(
        operator(),
        moved.replacementBookingId,
        {
          expectedRefundAmount: cancellation.refundAmount,
          reason: "Requested slot closed",
        },
        true,
      );
      const refunds = await db.refund.aggregate({
        where: { paymentId: source.confirmedPaymentId! },
        _sum: { amount: true },
      });
      expect(refunds._sum.amount).toBe(source.totalAmount);
    });

    it("enforces the last coupon redemption across different pitches and releases expired use", async () => {
      await verifyOwner();
      const [left, right] = await Promise.all([market(), market()]);
      const admin = await getPrisma().user.create({
        data: {
          name: "Admin",
          email: `${token()}@example.test`,
          role: "ADMIN",
        },
      });
      const code = `TEST_${token().slice(0, 12).toUpperCase()}`;
      await saveCoupon(
        { id: admin.id, role: "ADMIN" },
        {
          venueId: null,
          code,
          description: "Last use",
          discountType: "FIXED",
          discountValue: 500,
          maximumDiscount: null,
          minimumBookingAmount: 100,
          usageLimit: 1,
          usageLimitPerCustomer: 1,
          startsAt: new Date(Date.now() - 60000),
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
        },
      );
      const selections = await Promise.all(
        [left, right].map(async (market, index) => {
          const input = {
            pitchId: market.pitchId,
            slotIds: [market.ids[0]],
            couponCode: code,
            addons: [],
          };
          return {
            ...input,
            quoteFingerprint: (await publicQuote(input, customers[50 + index]))
              .fingerprint,
          };
        }),
      );
      const race = await Promise.allSettled(
        selections.map((selection, index) =>
          createBooking(customers[50 + index], selection, token()),
        ),
      );
      expect(
        race.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const winner = race.find((result) => result.status === "fulfilled");
      if (!winner || winner.status !== "fulfilled")
        throw Error("No coupon winner.");
      await forceExpiry(winner.value.booking.id);
      await expireBooking(winner.value.booking.id);
      expect(
        (
          await getPrisma().couponRedemption.findUniqueOrThrow({
            where: { bookingId: winner.value.booking.id },
          })
        ).status,
      ).toBe("RELEASED");
    });

    it("blocks and unblocks inventory, verifies single-use attendance, then permits a verified review", async () => {
      await verifyOwner();
      const { venue, pitchId, ids } = await market();
      const db = getPrisma();
      await changeSlotBlock(operator(), ids[2], {
        block: true,
        reason: "Surface maintenance",
      });
      expect(
        (await db.slot.findUniqueOrThrow({ where: { id: ids[2] } })).status,
      ).toBe("BLOCKED");
      await changeSlotBlock(operator(), ids[2], {
        block: false,
        reason: "Surface work finished",
      });
      const customer = await db.user.findUniqueOrThrow({
        where: { id: customers[44] },
      });
      const booking = await createManualBooking(
        operator(),
        {
          ...(await manualSelection(pitchId, [ids[0]])),
          identity: { type: "customer", email: customer.email },
        },
        token(),
      );
      await expect(
        submitReview(player(44), booking.id, { rating: 5 }),
      ).rejects.toMatchObject({ code: "REVIEW_NOT_ELIGIBLE" });
      await db.booking.update({
        where: { id: booking.id },
        data: {
          startAt: new Date(Date.now() + 60000),
          endAt: new Date(Date.now() + 1860000),
        },
      });
      const { token: checkIn } = await issueCheckInToken(
        player(44),
        booking.id,
      );
      const checked = await attendance(
        operator(),
        booking.id,
        "CHECKED_IN",
        checkIn,
      );
      expect(checked.checkedInById).toBe(ownerId);
      expect(
        await db.checkInToken.count({
          where: { bookingId: booking.id, usedAt: { not: null } },
        }),
      ).toBe(1);
      await db.booking.update({
        where: { id: booking.id },
        data: {
          startAt: new Date(Date.now() - 1860000),
          endAt: new Date(Date.now() - 60000),
        },
      });
      await attendance(operator(), booking.id, "COMPLETED");
      await submitReview(player(44), booking.id, {
        rating: 5,
        comment: "Good cricket surface.",
      });
      expect((await publicReviews(venue.slug)).average).toBe(5);
    });

    it("queues a scheduled reminder once even when workers overlap", async () => {
      await verifyOwner();
      const { pitchId, ids } = await market();
      const db = getPrisma();
      const customer = await db.user.findUniqueOrThrow({
        where: { id: customers[56] },
      });
      const booking = await createManualBooking(
        operator(),
        {
          ...(await manualSelection(pitchId, [ids[0]])),
          identity: { type: "customer", email: customer.email },
        },
        token(),
      );
      const now = Date.now();
      await db.booking.update({
        where: { id: booking.id },
        data: {
          startAt: new Date(now + 90 * 60000),
          endAt: new Date(now + 120 * 60000),
          confirmedAt: new Date(now - 4 * 3600000),
        },
      });
      await Promise.all([remindBookings(), remindBookings()]);
      expect(
        await db.notification.count({
          where: { bookingId: booking.id, type: "BOOKING_REMINDER" },
        }),
      ).toBe(1);
    });

    it("yields exactly one winner for 100 concurrent customers on one slot", async () => {
      const { pitchId, ids, availabilityMs } = await market();
      const input = await selectionFor(pitchId, ids.slice(0, 1));
      const timings: number[] = [];
      const results = await Promise.allSettled(
        customers.map(async (id) => {
          const before = performance.now();
          try {
            return await createBooking(id, input, randomUUID());
          } finally {
            timings.push(performance.now() - before);
          }
        }),
      );
      const winners = results.filter((result) => result.status === "fulfilled");
      expect(winners).toHaveLength(1);
      expect(
        results
          .filter((result) => result.status === "rejected")
          .every((result) => result.reason.code === "SLOTS_UNAVAILABLE"),
      ).toBe(true);
      expect(
        await getPrisma().slot.count({ where: { id: ids[0], status: "HELD" } }),
      ).toBe(1);
      console.info("Local booking contention sample", {
        availabilityMs: Math.round(availabilityMs),
        p95HoldMs: Math.round(timings.sort((a, b) => a - b)[94]),
        requests: 100,
      });
      if (winners[0].status === "fulfilled")
        await releaseBooking(
          winners[0].value.booking.id,
          winners[0].value.booking.customerId!,
        );
    }, 40_000);

    it("rolls back the losing overlapping request and reuses identical idempotency keys", async () => {
      const { pitchId, venue, ids } = await market();
      const a = await selectionFor(pitchId, ids.slice(0, 2), [
        { addonId: venue.addons[0].id, quantity: 1 },
      ]);
      const b = await selectionFor(pitchId, ids.slice(1, 3));
      const key = randomUUID();
      const [left, right] = await Promise.allSettled([
        createBooking(customers[0], a, key),
        createBooking(customers[1], b, key),
      ]);
      expect(
        [left, right].filter((item) => item.status === "fulfilled"),
      ).toHaveLength(1);
      const customerId =
        left.status === "fulfilled" ? customers[0] : customers[1];
      const input = left.status === "fulfilled" ? a : b;
      const replay = await createBooking(customerId, input, key);
      expect(replay.replay).toBe(true);
      await expect(
        createBooking(
          customerId,
          { ...input, quoteFingerprint: "0".repeat(64) },
          key,
        ),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_MISMATCH" });
      expect(
        await getPrisma().bookingItem.count({
          where: { bookingId: replay.booking.id },
        }),
      ).toBe(2);
      expect(
        await getPrisma().slot.count({ where: { pitchId, status: "HELD" } }),
      ).toBe(2);
      await expect(
        bookingView(
          replay.booking.id,
          customerId === customers[0] ? customers[1] : customers[0],
        ),
      ).rejects.toMatchObject({ status: 404 });
      await releaseBooking(replay.booking.id, customerId);
      expect(
        await getPrisma().bookingItem.count({
          where: { bookingId: replay.booking.id },
        }),
      ).toBe(2);
    });

    it("allows simultaneous holds on different pitches at one venue", async () => {
      const first = await market();
      const second = await getPrisma().pitch.create({
        data: {
          venueId: first.venue.id,
          name: "Second pitch",
          pitchType: "BOX_CRICKET",
          surfaceType: "ARTIFICIAL_TURF",
          lengthInMeters: 35,
          widthInMeters: 20,
          capacity: 12,
          basePrice: 80000,
          slotDurationMinutes: 30,
          minimumBookingMinutes: 30,
          hours: {
            create: [
              { dayOfWeek: dayOfWeek(day), openingTime: 600, closingTime: 660 },
            ],
          },
        },
      });
      await generateOwnerSlots(ownerId, second.id);
      const slots = (await pitchAvailability(second.id, day)).slots;
      const a = await selectionFor(first.pitchId, [first.ids[0]]);
      const b = await selectionFor(second.id, [slots[0].id]);
      const [left, right] = await Promise.all([
        createBooking(customers[3], a, randomUUID()),
        createBooking(customers[4], b, randomUUID()),
      ]);
      expect(left.booking.pitchId).not.toBe(right.booking.pitchId);
      await releaseBooking(left.booking.id, customers[3]);
      await releaseBooking(right.booking.id, customers[4]);
    });

    it("rejects a changed quote and caps two simultaneous holds by the same customer", async () => {
      const a = await market(),
        b = await market();
      const original = await selectionFor(a.pitchId, [a.ids[0]]);
      await getPrisma().slot.update({
        where: { id: a.ids[0] },
        data: { price: 60000 },
      });
      await expect(
        createBooking(customers[2], original, randomUUID()),
      ).rejects.toMatchObject({ code: "PRICE_CHANGED" });
      const first = await selectionFor(a.pitchId, [a.ids[0]]);
      const second = await selectionFor(b.pitchId, [b.ids[0]]);
      const results = await Promise.allSettled([
        createBooking(customers[2], first, randomUUID()),
        createBooking(customers[2], second, randomUUID()),
      ]);
      expect(
        results
          .filter((item) => item.status === "rejected")
          .map((item) => item.reason.code),
      ).toEqual(["ACTIVE_HOLD_LIMIT"]);
      const winner = results.find((item) => item.status === "fulfilled")!;
      if (winner.status === "fulfilled")
        await releaseBooking(winner.value.booking.id, customers[2]);
    });

    it("does not let a late capture displace the next customer's hold", async () => {
      const { pitchId, ids } = await market();
      const { booking } = await createBooking(
        customers[5],
        await selectionFor(pitchId, [ids[0]]),
        randomUUID(),
      );
      const { order, gateway } = await orderFor(customers[5], booking.id);
      await forceExpiry(booking.id);
      expect((await expireBooking(booking.id)).status).toBe("EXPIRED");
      const next = (
        await createBooking(
          customers[6],
          await selectionFor(pitchId, [ids[0]]),
          randomUUID(),
        )
      ).booking;
      expect(
        await processProviderPayment(order, gateway.capture(order)),
      ).toMatchObject({ status: "EXPIRED", paymentStatus: "REFUND_PENDING" });
      expect(
        await getPrisma().slot.findUnique({ where: { id: ids[0] } }),
      ).toMatchObject({ activeBookingId: next.id, status: "HELD" });
      expect(
        await getPrisma().refund.count({ where: { bookingId: booking.id } }),
      ).toBe(1);
      await releaseBooking(next.id, customers[6]);
      for (let index = 0; index < 4; index++)
        await processOutbox(gateway.provider, 25);
      expect(
        await getPrisma().refund.findFirst({
          where: { bookingId: booking.id },
        }),
      ).toMatchObject({ status: "PROCESSED" });
    });

    it("serializes expiry and payment confirmation to one terminal outcome", async () => {
      const { pitchId, ids } = await market();
      const { booking } = await createBooking(
        customers[7],
        await selectionFor(pitchId, [ids[0]]),
        randomUUID(),
      );
      const { order, gateway } = await orderFor(customers[7], booking.id);
      await forceExpiry(booking.id);
      await Promise.all([
        expireBooking(booking.id),
        processProviderPayment(order, gateway.capture(order)),
      ]);
      expect((await bookingView(booking.id, customers[7])).status).toBe(
        "EXPIRED",
      );
      expect(
        await getPrisma().slot.findUnique({ where: { id: ids[0] } }),
      ).toMatchObject({
        activeBookingId: null,
        status: "AVAILABLE",
        holdExpiresAt: null,
      });
      expect(
        await getPrisma().refund.count({ where: { bookingId: booking.id } }),
      ).toBe(1);
      for (let index = 0; index < 4; index++)
        await processOutbox(gateway.provider, 25);
    });

    it("deduplicates ten webhooks, rejects old failures, and compensates an extra capture", async () => {
      const { pitchId, ids } = await market();
      const { booking } = await createBooking(
        customers[8],
        await selectionFor(pitchId, [ids[0]]),
        randomUUID(),
      );
      const { order, gateway } = await orderFor(customers[8], booking.id);
      const charge = gateway.capture(order);
      const body = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: { ...charge, card: { number: "synthetic-never-persist" } },
          },
        },
      });
      const eventId = `evt_${token()}`;
      const events = await Promise.all(
        Array.from({ length: 10 }, () =>
          persistWebhook(Buffer.from(body), sign(body), eventId, secret),
        ),
      );
      await Promise.all(
        events.map((event) => processWebhook(event.id, gateway.provider)),
      );
      expect(new Set(events.map((event) => event.id)).size).toBe(1);
      expect(JSON.stringify(events[0].payload)).not.toContain(
        "synthetic-never-persist",
      );
      expect(
        await getPrisma().notification.count({
          where: { bookingId: booking.id, type: "BOOKING_CONFIRMED" },
        }),
      ).toBe(1);
      expect(
        await getPrisma().outboxEvent.count({
          where: { aggregateId: booking.id, eventType: "BOOKING_RECEIPT" },
        }),
      ).toBe(1);
      expect(
        await processProviderPayment(order, {
          ...charge,
          status: "failed",
          captured: false,
        }),
      ).toMatchObject({ status: "CONFIRMED", paymentStatus: "CAPTURED" });
      const extra = gateway.capture(order);
      expect(await processProviderPayment(order, extra)).toMatchObject({
        status: "CONFIRMED",
        paymentStatus: "REFUND_PENDING",
      });
      expect(
        (await bookingView(booking.id, customers[8])).confirmedPayment
          ?.providerPaymentId,
      ).toBe(charge.id);
      const pdf = await receiptForCustomer(booking.id, customers[8]);
      expect(Buffer.from(pdf.pdf).subarray(0, 4).toString()).toBe("%PDF");
      await expect(
        receiptForCustomer(booking.id, customers[9]),
      ).rejects.toMatchObject({ status: 404 });
      for (let index = 0; index < 4; index++)
        await processOutbox(gateway.provider, 25);
      expect(
        await getPrisma().refund.findFirst({
          where: { bookingId: booking.id },
        }),
      ).toMatchObject({ status: "PROCESSED" });
    });

    it("reconciles an ambiguous order without creating a second order and never confirms a mismatched amount", async () => {
      const { pitchId, ids } = await market();
      const { booking } = await createBooking(
        customers[10],
        await selectionFor(pitchId, [ids[0]]),
        randomUUID(),
      );
      const gateway = stub();
      gateway.failResponse();
      await expect(
        startPayment(customers[10], booking.id, contact, gateway.provider),
      ).rejects.toThrow("lost provider response");
      await getPrisma().paymentOrder.update({
        where: { bookingId: booking.id },
        data: { nextCheckAt: new Date(0) },
      });
      await reconcilePayments(gateway.provider);
      const order = await getPrisma().paymentOrder.findUniqueOrThrow({
        where: { bookingId: booking.id },
      });
      expect(order.providerOrderId).toBeTruthy();
      expect(gateway.creates()).toBe(1);
      const incorrect = gateway.capture(order, order.amount + 1);
      await expect(
        verifyCheckout(
          customers[11],
          {
            bookingId: booking.id,
            razorpay_order_id: incorrect.order_id,
            razorpay_payment_id: incorrect.id,
            razorpay_signature: sign(`${incorrect.order_id}|${incorrect.id}`),
          },
          gateway.provider,
        ),
      ).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
      expect(
        await verifyCheckout(
          customers[10],
          {
            bookingId: booking.id,
            razorpay_order_id: incorrect.order_id,
            razorpay_payment_id: incorrect.id,
            razorpay_signature: sign(`${incorrect.order_id}|${incorrect.id}`),
          },
          gateway.provider,
        ),
      ).toMatchObject({ validAmount: false, paymentStatus: "REFUND_PENDING" });
      expect(
        await getPrisma().slot.findUnique({ where: { id: ids[0] } }),
      ).toMatchObject({ status: "HELD" });
      await releaseBooking(booking.id, customers[10]);
      for (let index = 0; index < 4; index++)
        await processOutbox(gateway.provider, 25);
    });

    it("confirms a missing webhook using reconciliation without reopening inventory", async () => {
      const { pitchId, ids } = await market();
      const { booking } = await createBooking(
        customers[12],
        await selectionFor(pitchId, [ids[0]]),
        randomUUID(),
      );
      await saveCheckout(booking.id, customers[12], contact);
      const { order, gateway } = await orderFor(customers[12], booking.id);
      gateway.capture(order);
      await getPrisma().paymentOrder.update({
        where: { bookingId: booking.id },
        data: { nextCheckAt: new Date(0) },
      });
      await reconcilePayments(gateway.provider);
      expect((await bookingView(booking.id, customers[12])).status).toBe(
        "CONFIRMED",
      );
      expect(
        await getPrisma().slot.findUnique({ where: { id: ids[0] } }),
      ).toMatchObject({
        status: "BOOKED",
        activeBookingId: booking.id,
        holdExpiresAt: null,
      });
      expect(atVenueTime(day, 600, zone)).toEqual(booking.startAt);
    });
  },
);
