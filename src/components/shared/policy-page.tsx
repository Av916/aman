import Link from "next/link";
import { PublicNav } from "@/components/layouts/public-nav";
import { deploymentSettings } from "@/lib/deployment";

const pages = {
  privacy: {
    title: "Privacy",
    sections: [
      [
        "Information used",
        "PitchMate uses account names, email addresses and phone numbers to provide access and send booking updates. Venue operators receive the contact details they need to manage their own bookings. Guest contact information stays scoped to its venue.",
      ],
      [
        "Payments and delivery",
        "Razorpay collects online payment details through hosted checkout. PitchMate receives payment references and status updates. Email and image providers receive the data needed for their services.",
      ],
      [
        "Data requests",
        "Contact support to request access, correction, or account closure. Use the email associated with your account so support can verify your identity. Some invoices, refunds, and accounting records may need to be retained.",
      ],
    ],
  },
  terms: {
    title: "Terms of use",
    sections: [
      [
        "Reservations",
        "Review the pitch, dates, add-ons, charges, and cancellation terms before payment. PitchMate sends a confirmation once the booking is accepted. An unpaid online hold expires at the time shown at checkout.",
      ],
      [
        "Venue operations",
        "The venue operates the facility and sets its rules for attendance and use. Contact support if the venue cannot honor your confirmed booking.",
      ],
    ],
  },
  "cancellation-policy": {
    title: "Cancellation policy",
    sections: [
      [
        "Your booking terms",
        "The terms shown before checkout are saved with your booking. The booking details page shows cancellation eligibility and the refund quote before you confirm.",
      ],
      [
        "Venue cancellations",
        "Venue-initiated cancellations can return the remaining eligible amount. Contact support if an event was cancelled without an update to your booking.",
      ],
    ],
  },
  "refund-policy": {
    title: "Refund policy",
    sections: [
      [
        "Refund quotes",
        "The applicable cancellation terms, original collection, and refunds already reserved determine the available refund. The latest quote is shown before you cancel.",
      ],
      [
        "Settlement",
        "Online refunds return through the payment provider. Offline refunds are handled by the venue. Follow the status in your booking details and contact support with the booking reference if there is a delay.",
      ],
    ],
  },
  contact: {
    title: "Contact and data requests",
    sections: [
      [
        "Booking support",
        "Include the booking reference and describe what happened. Please leave passwords, verification codes, and payment card details out of your message.",
      ],
      [
        "Privacy and account closure",
        "Write from the email address associated with your account and identify the request. Support can verify identity and explain the next steps before making changes.",
      ],
    ],
  },
} as const;

export type PolicyPageName = keyof typeof pages;

export function PolicyPage({ page }: { page: PolicyPageName }) {
  const { title, sections } = pages[page];
  const address = deploymentSettings().SUPPORT_EMAIL;
  return (
    <>
      <PublicNav />
      <main
        id="main-content"
        className="mx-auto grid max-w-3xl gap-6 px-5 py-12"
      >
        <h1 className="text-4xl font-bold">{title}</h1>
        {sections.map(([heading, copy]) => (
          <section key={heading} className="grid gap-2">
            <h2 className="text-xl font-bold">{heading}</h2>
            <p>{copy}</p>
          </section>
        ))}
        {page === "contact" &&
          (address ? (
            <a className="font-bold underline" href={`mailto:${address}`}>
              Email {address}
            </a>
          ) : (
            <p>Support email will appear here when it is configured.</p>
          ))}
        <nav
          aria-label="PitchMate policies"
          className="flex flex-wrap gap-3 text-sm"
        >
          {Object.entries(pages)
            .filter(([key]) => key !== page)
            .map(([key, item]) => (
              <Link
                className="font-semibold underline"
                key={key}
                href={`/${key}`}
              >
                {item.title}
              </Link>
            ))}
        </nav>
      </main>
    </>
  );
}
