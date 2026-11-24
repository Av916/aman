import { BookingResult } from "@/components/bookings/booking-result";
import { customerBookingPage } from "@/modules/checkout/page.service";
export const metadata = { title: "Booking confirmation" };
export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  return (
    <BookingResult
      booking={await customerBookingPage((await params).bookingId)}
      confirmation
    />
  );
}
