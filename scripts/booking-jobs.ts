import "dotenv/config";
import { getPrisma } from "@/lib/prisma";
import {
  expireBookings,
  processOutbox,
  reconcilePayments,
  remindBookings,
} from "@/modules/jobs/service";
import { bookingSettings } from "@/modules/bookings/settings";

try {
  const expiration = await expireBookings();
  const payments = bookingSettings().RAZORPAY_KEY_ID
    ? await reconcilePayments()
    : null;
  console.info({
    expiration,
    payments,
    reminders: await remindBookings(),
    outbox: await processOutbox(),
  });
} finally {
  await getPrisma().$disconnect();
}
