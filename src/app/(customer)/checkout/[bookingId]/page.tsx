import { redirect } from "next/navigation";
import { PublicNav } from "@/components/layouts/public-nav";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { BookingSummary } from "@/components/bookings/booking-summary";
import { CheckoutForm } from "@/components/bookings/checkout-form";
import { customerBookingPage } from "@/modules/checkout/page.service";
import { bookingSettings } from "@/modules/bookings/settings";

export const metadata = { title: "Checkout" };
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const booking = await customerBookingPage((await params).bookingId);
  if (booking.status !== "PENDING_PAYMENT")
    redirect(`/bookings/${booking.id}/confirmation`);
  const startedAt = await Promise.resolve(new Date().getTime());
  return (
    <>
      <PublicNav />
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <Breadcrumbs
          items={[
            { label: "My Bookings", href: "/dashboard/bookings" },
            { label: "Checkout" },
          ]}
        />
        <h1 className="mb-6 text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">
          Checkout
        </h1>
        <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="lg:order-2 lg:sticky lg:top-4">
            <BookingSummary booking={booking} compact />
          </div>
          <CheckoutForm
            booking={booking}
            startedAt={startedAt}
            ready={Boolean(bookingSettings().RAZORPAY_KEY_ID)}
          />
        </div>
      </main>
    </>
  );
}
