import { CustomerBookingActions } from "@/components/operations/customer-booking";
import { readPolicy } from "@/modules/cancellations/policy";
import { BookingResult } from "@/components/bookings/booking-result";
import { customerBookingPage } from "@/modules/checkout/page.service";
export const metadata = { title: "Booking details" };
export default async function BookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const booking = await customerBookingPage((await params).bookingId);
  return (
    <>
      <BookingResult booking={booking} />
      <CustomerBookingActions
        booking={booking}
        policy={readPolicy(booking.cancellationPolicySnapshot)}
      />
    </>
  );
}
