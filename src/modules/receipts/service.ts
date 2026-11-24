import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import { bookingView } from "@/modules/bookings/booking.repository";

const eligible = (status: string) =>
  ["CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW"].includes(status);
const amount = (paise: number) => `INR ${(paise / 100).toFixed(2)}`;
const safe = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?");

export async function generateReceipt(id: string) {
  const db = getPrisma();
  const existing = await db.bookingReceipt.findUnique({
    where: { bookingId: id },
  });
  if (existing) return existing;
  const booking = await db.booking.findUniqueOrThrow({
    where: { id },
    include: {
      confirmedPayment: true,
      allocations: { select: { amount: true } },
      items: { orderBy: { startAt: "asc" } },
      addons: { orderBy: { nameSnapshot: "asc" } },
    },
  });
  if (
    !eligible(booking.status) ||
    !(booking.confirmedPayment?.paidAt || booking.allocations.length) ||
    !booking.confirmedAt
  )
    throw new AppError(
      409,
      "RECEIPT_UNAVAILABLE",
      "A receipt is available after the booking is confirmed.",
    );
  const reference = booking.bookingNumber.replace(/^PM-/, "PMR-");
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: booking.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  const doc = await PDFDocument.create();
  doc.setTitle(`PitchMate booking receipt ${reference}`);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 795;
  function line(value: string, big = false) {
    const font = big ? bold : regular;
    const size = big ? 17 : 11;
    let row = "";
    const write = (text: string) => {
      if (y < 52) {
        page = doc.addPage([595, 842]);
        y = 795;
      }
      page.drawText(text, {
        x: 44,
        y,
        size,
        font,
        color: rgb(0.06, 0.18, 0.14),
      });
      y -= big ? 30 : 18;
    };
    for (const word of safe(value).split(/\s+/)) {
      const next = row ? `${row} ${word}` : word;
      if (row && font.widthOfTextAtSize(next, size) > 500) {
        write(row);
        row = word;
      } else row = next;
    }
    if (row) write(row.slice(0, 110));
  }
  line("PitchMate | Booking receipt", true);
  line(`Receipt ${reference} | Booking ${booking.bookingNumber}`);
  line(`Customer: ${booking.customerName}`);
  line(`${booking.venueName} | ${booking.venueAddress}`);
  line(`Pitch: ${booking.pitchName}`);
  line(
    `${time.format(booking.startAt)} to ${time.format(booking.endAt)} (${booking.timezone})`,
  );
  line(`Duration: ${booking.durationMinutes} minutes`);
  line("Itemized charges", true);
  for (const item of booking.items)
    line(
      `${time.format(item.startAt)} | ${item.durationMinutes} minutes | ${amount(item.unitPrice)}`,
    );
  for (const item of booking.addons)
    line(
      `${item.nameSnapshot} x ${item.quantity} | ${amount(item.totalPrice)}`,
    );
  line(`Slot subtotal: ${amount(booking.subtotal)}`);
  line(`Add-ons: ${amount(booking.addonTotal)}`);
  line(`Discount: ${amount(booking.discountAmount)}`);
  line(`Platform fee: ${amount(booking.platformFee)}`);
  line(`Tax: ${amount(booking.taxAmount)}`);
  line(`Total paid: ${amount(booking.totalAmount)}`, true);
  if (booking.allocations.length)
    line("Paid by transfer from original booking and any additional payment.");
  if (booking.confirmedPayment)
    line(
      `Payment: ${booking.confirmedPayment.paymentMethod ?? "Razorpay"} | ${booking.confirmedPayment.providerPaymentId}`,
    );
  line(`Confirmed: ${time.format(booking.confirmedAt)} (${booking.timezone})`);
  return db.bookingReceipt.upsert({
    where: { bookingId: id },
    update: {},
    create: { bookingId: id, reference, pdf: new Uint8Array(await doc.save()) },
  });
}

export async function receiptForCustomer(id: string, customerId: string) {
  const booking = await bookingView(id, customerId);
  if (
    !eligible(booking.status) ||
    (!booking.confirmedPayment?.paidAt && !booking.allocations.length)
  )
    throw new AppError(
      409,
      "RECEIPT_UNAVAILABLE",
      "A receipt is available after the booking is confirmed.",
    );
  return generateReceipt(id);
}

const icalDate = (value: Date) =>
  value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
const escaped = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
function fold(line: string) {
  let piece = "";
  const lines: string[] = [];
  for (const character of line) {
    if (Buffer.byteLength(piece + character) > 75) {
      lines.push(piece);
      piece = " ";
    }
    piece += character;
  }
  return [...lines, piece].join("\r\n");
}
export async function calendarForCustomer(id: string, customerId: string) {
  const booking = await bookingView(id, customerId);
  if (!eligible(booking.status))
    throw new AppError(
      409,
      "CALENDAR_UNAVAILABLE",
      "Add this booking after confirmation.",
    );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PitchMate//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@pitchmate`,
    `DTSTAMP:${icalDate(booking.confirmedAt ?? booking.createdAt)}`,
    `DTSTART:${icalDate(booking.startAt)}`,
    `DTEND:${icalDate(booking.endAt)}`,
    `SUMMARY:${escaped(booking.pitchName + " at " + booking.venueName)}`,
    `LOCATION:${escaped(booking.venueAddress)}`,
    `DESCRIPTION:${escaped("PitchMate booking " + booking.bookingNumber)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
