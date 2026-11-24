import { AppError, endpoint, success } from "@/lib/api";
import { bookingSettings } from "@/modules/bookings/settings";
import { validJobToken } from "@/modules/payments/signatures";
import {
  expireBookings,
  reconcilePayments,
  processOutbox,
  remindBookings,
} from "./service";

const jobs = {
  expire: () => expireBookings(),
  reconcile: () => reconcilePayments(),
  reminders: () => remindBookings(),
  outbox: () => processOutbox(),
};
export const bookingJob = (job: keyof typeof jobs) =>
  endpoint(async (r) => {
    if (
      !validJobToken(
        r.headers.get("authorization"),
        bookingSettings().INTERNAL_JOB_SECRET,
      )
    )
      throw new AppError(401, "UNAUTHENTICATED", "Invalid job credentials.");
    return success("Job batch completed.", await jobs[job]());
  });
