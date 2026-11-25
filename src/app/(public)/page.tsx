import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  Building2,
  CalendarDays,
  CalendarCheck,
  ChevronDown,
  Clock,
  Flag,
  ListChecks,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/branding/logo";
import { PublicNav } from "@/components/layouts/public-nav";
import { TurfSearch } from "@/components/forms/turf-preview-search";
import { listCities } from "@/modules/venues/public-http";
import { featuredVenues } from "@/modules/venues/venue.repository";
import { VenueCard } from "@/components/venues/venue-card";
import { currentUser } from "@/lib/auth";
import { databaseConnectionErrorCode } from "@/lib/database-errors";
import { log } from "@/lib/log";
import { savedVenueIds } from "@/modules/favorites/service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const steps = [
  {
    title: "Find your ground",
    description:
      "Explore cricket turfs by city, surface and facilities to find a pitch that fits your group.",
    icon: Search,
  },
  {
    title: "Choose a time",
    description:
      "Check the pitch schedule and see the full price before you reserve.",
    icon: CalendarDays,
  },
  {
    title: "Get the team together",
    description:
      "Share the booking details with your friends and head to the ground.",
    icon: CalendarCheck,
  },
];
const questions = [
  {
    question: "Can I book a cricket turf right now?",
    answer:
      "Yes. Choose an available pitch and time, review the price, and complete payment to confirm your booking.",
  },
  {
    question: "How do I become a turf owner on PitchMate?",
    answer:
      "Choose List Your Turf and register with your business name and phone number. Verify your email to access the owner dashboard and check your approval status.",
  },
  {
    question: "Are the listed grounds and prices real?",
    answer:
      "Published listings show venue information and hourly rates supplied by verified turf owners.",
  },
  {
    question: "Can I sign up as a player today?",
    answer:
      "Yes. Create a player account and verify your email to access your profile and account settings.",
  },
];

async function loadHomeData<T>(
  event: string,
  load: () => Promise<T>,
): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    const code = databaseConnectionErrorCode(error);
    if (!code) throw error;
    log("warn", event, { code });
    return null;
  }
}

async function HomeSearch() {
  const cities = await loadHomeData("home.cities_unavailable", listCities);
  return <TurfSearch cities={cities ?? []} />;
}

async function loadFeaturedTurfs() {
  const [turfs, user] = await Promise.all([featuredVenues(), currentUser()]);
  const saved =
    user?.role === "CUSTOMER"
      ? await savedVenueIds(
          user.id,
          turfs.map((venue) => venue.id),
        )
      : [];
  return { turfs, saved, role: user?.role };
}

async function FeaturedTurfs() {
  const featured = await loadHomeData(
    "home.featured_unavailable",
    loadFeaturedTurfs,
  );
  if (!featured) {
    return (
      <p className="rounded-xl border border-border bg-surface p-5 text-muted">
        Featured turfs are temporarily unavailable.{" "}
        <Link
          className="font-semibold underline underline-offset-4"
          href="/turfs"
        >
          Browse all turfs
        </Link>
      </p>
    );
  }
  const { turfs, saved, role } = featured;
  if (!turfs.length) {
    return (
      <p className="rounded-xl border border-border bg-surface p-5 text-muted">
        Published grounds will appear here.
      </p>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {turfs.map((venue) => (
        <VenueCard
          key={venue.id}
          venue={venue}
          role={role}
          saved={saved.includes(venue.id)}
        />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <PublicNav />
      <main id="main-content">
        <section className="on-dark relative isolate mx-auto flex min-h-[31rem] max-w-[92rem] items-center overflow-hidden bg-forest text-cream sm:mx-4 sm:mt-4 sm:min-h-[36rem] sm:rounded-[2rem] lg:mx-6 2xl:mx-auto">
          <Image
            src="/images/cricket-hero.webp"
            alt="Cricket players on an outdoor ground at dusk"
            fill
            loading="eager"
            fetchPriority="high"
            sizes="100vw"
            className="-z-20 object-cover object-[62%_50%]"
          />
          <div className="absolute inset-0 -z-10 bg-linear-to-r from-forest from-5% via-forest/90 via-58% to-forest/30 md:via-forest/80 md:via-45% md:to-forest/10" />
          <div className="mx-auto w-full max-w-[80rem] px-5 pt-11 pb-21 sm:px-8 lg:px-10">
            <p className="mb-4 flex items-center gap-2 text-sm font-extrabold tracking-[.16em] text-accent uppercase">
              <Flag size={17} aria-hidden="true" /> Cricket turf booking
            </p>
            <h1 className="font-heading text-[clamp(3.25rem,7.4vw,6.6rem)] leading-[.96] font-extrabold tracking-[-.07em]">
              Your Game.
              <br />
              <span className="text-accent">Your Pitch.</span>
            </h1>
            <p className="mt-5 max-w-[32rem] text-lg leading-relaxed text-cream sm:text-xl">
              From weekday nets to weekend matches, find the right ground for
              the cricket you play.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="accent" size="lg">
                <Link href="#turf-search">Find a Turf</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-cream/65 bg-forest/85 text-cream hover:bg-forest hover:text-cream"
              >
                <Link href="/register-owner">List Your Turf</Link>
              </Button>
            </div>
          </div>
        </section>

        <div
          id="turf-search"
          className="relative z-10 mx-auto -mt-10 max-w-[69rem] scroll-mt-24 px-5 sm:px-8"
        >
          <Suspense fallback={<Skeleton className="h-44 bg-surface md:h-28" />}>
            <HomeSearch />
          </Suspense>
        </div>

        <section
          id="turfs"
          className="mx-auto max-w-[80rem] scroll-mt-24 px-5 py-15 sm:px-8 sm:py-19 lg:px-10"
        >
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">
                Featured turfs
              </h2>
              <p className="mt-2 text-muted">
                Recently published grounds on PitchMate.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/turfs">Explore all turfs</Link>
            </Button>
          </div>
          <Suspense
            fallback={
              <div className="grid gap-5 md:grid-cols-3" role="status">
                <span className="sr-only">Loading featured turfs</span>
                <Skeleton className="h-64" />
                <Skeleton className="hidden h-64 md:block" />
                <Skeleton className="hidden h-64 md:block" />
              </div>
            }
          >
            <FeaturedTurfs />
          </Suspense>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-18 border-y border-border bg-surface"
        >
          <div className="mx-auto max-w-[80rem] px-5 py-15 sm:px-8 lg:px-10">
            <h2 className="text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">
              How PitchMate works
            </h2>
            <p className="mt-2 text-muted">
              From finding a ground to confirming match day.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {steps.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-sage/30 bg-background p-6"
                >
                  <span className="mb-4 grid size-11 place-items-center rounded-xl bg-highlight text-brand-dot">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-extrabold">{title}</h3>
                  <p className="mt-2 text-muted">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[80rem] items-center gap-8 px-5 py-15 sm:px-8 md:grid-cols-2 lg:gap-14 lg:px-10">
          <div className="relative aspect-[1.58] overflow-hidden rounded-2xl bg-highlight">
            <Image
              src="/images/players.webp"
              alt="Cricket players walking onto the pitch"
              fill
              sizes="(max-width: 768px) 92vw, 48vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="text-4xl font-extrabold tracking-[-.05em]">
              More time on the pitch
            </h2>
            <p className="mt-3 text-muted">
              PitchMate is designed around how cricket groups plan a game.
            </p>
            <ul className="mt-5 grid gap-4">
              <li className="flex items-start gap-3">
                <MapPin className="mt-1 shrink-0 text-brand-dot" size={19} />
                <span>
                  <strong>Compare grounds.</strong> Check the surface,
                  facilities and location in one place.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-1 shrink-0 text-brand-dot" size={19} />
                <span>
                  <strong>Pick a slot together.</strong> Plan around a shared
                  schedule.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Users className="mt-1 shrink-0 text-brand-dot" size={19} />
                <span>
                  <strong>Get everyone there.</strong> Share the match details
                  with your group.
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section
          id="owners"
          className="on-dark mx-auto max-w-[92rem] scroll-mt-18 bg-forest text-cream sm:mx-4 sm:rounded-[2rem] lg:mx-6 2xl:mx-auto"
        >
          <div className="mx-auto grid max-w-[80rem] gap-10 px-5 py-15 sm:px-8 md:grid-cols-[1fr_.8fr] lg:px-10">
            <div>
              <p className="text-sm font-extrabold tracking-[.13em] text-accent uppercase">
                For turf owners
              </p>
              <h2 className="mt-2 text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">
                Give your ground a home.
              </h2>
              <p className="mt-3 max-w-lg text-cream/90">
                Create an owner account and submit your business details ahead
                of live turf listings.
              </p>
              <Button asChild variant="accent" className="mt-6">
                <Link href="/register-owner">List Your Turf</Link>
              </Button>
            </div>
            <ul className="grid content-center gap-4 rounded-2xl border border-sage/65 bg-sage/15 p-5 font-semibold sm:p-6">
              <li className="flex items-center gap-3">
                <Building2 className="text-accent" size={22} /> Give players a
                place to discover your facility
              </li>
              <li className="flex items-center gap-3">
                <ListChecks className="text-accent" size={22} /> Prepare for
                schedules and reservations in one dashboard
              </li>
              <li className="flex items-center gap-3">
                <ShieldCheck className="text-accent" size={22} /> Check your
                owner verification status
              </li>
            </ul>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-[57rem] px-5 py-16 sm:px-8">
          <h2 className="text-4xl font-extrabold tracking-[-.05em]">
            Frequently asked questions
          </h2>
          <div className="mt-6 divide-y divide-border border-y border-border">
            {questions.map(({ question, answer }) => (
              <details key={question} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 font-bold [&::-webkit-details-marker]:hidden">
                  {question}
                  <ChevronDown
                    size={19}
                    className="shrink-0 text-brand-dot transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="max-w-2xl pb-4 text-muted">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-[80rem] flex-wrap items-center justify-between gap-6 px-5 py-7 sm:px-8 lg:px-10">
          <Logo />
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold"
          >
            <Link href="/turfs">Explore turfs</Link>
            <Link href="#faq">FAQ</Link>
            <Link href="/register-owner">For owners</Link>
            <Link href="/login">Log in</Link>
          </nav>
          <p className="text-sm text-muted">
            © {new Date().getUTCFullYear()} PitchMate
          </p>
        </div>
        <nav
          aria-label="Policies"
          className="mt-4 flex flex-wrap gap-4 text-sm"
        >
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
          <Link href="/terms" className="underline">
            Terms
          </Link>
          <Link href="/cancellation-policy" className="underline">
            Cancellations
          </Link>
          <Link href="/refund-policy" className="underline">
            Refunds
          </Link>
          <Link href="/contact" className="underline">
            Contact
          </Link>
        </nav>
      </footer>
    </>
  );
}
