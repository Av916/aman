import { notFound } from "next/navigation";
import { requireDashboardRole } from "@/lib/auth";
import { AppError } from "@/lib/api";
import { idSchema } from "@/modules/venues/venue.validation";
import { currentBooking } from "@/modules/bookings/http";

export async function customerBookingPage(rawId: string) {
  const user = await requireDashboardRole("CUSTOMER");
  const id = idSchema.safeParse(rawId);
  if (!id.success) notFound();
  try {
    return await currentBooking(id.data, user.id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
