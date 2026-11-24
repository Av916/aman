import Image from "next/image";
import Link from "next/link";
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
import { TurfPreviewSearch } from "@/components/forms/turf-preview-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const turfs = [
  {
    name: "Boundary Box Arena",
    location: "Whitefield, Bengaluru",
    type: "Box cricket",
    price: "₹1,200",
    image: "boundary",
    alt: "Enclosed cricket turf beside city buildings",
  },
  {
    name: "Willow Greens",
    location: "Gachibowli, Hyderabad",
    type: "Outdoor ground",
    price: "₹1,500",
    image: "willow",
    alt: "Open cricket ground bordered by palms",
  },
  {
    name: "Highline Cricket Club",
    location: "Baner, Pune",
    type: "Rooftop turf",
    price: "₹950",
    image: "highline",
    alt: "Rooftop cricket turf under evening floodlights",
  },
];
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
      "You can create a PitchMate account and explore sample listings. Live search, availability and reservations are planned for Phase 2.",
  },
  {
    question: "How do I become a turf owner on PitchMate?",
    answer:
      "Choose List Your Turf and register with your business name and phone number. Verify your email to access the owner dashboard and check your approval status.",
  },
  {
    question: "Are the listed grounds and prices real?",
    answer:
      "The featured grounds, photos and prices are demonstrations. They show what a future listing will look like.",
  },
  {
    question: "Can I sign up as a player today?",
    answer:
      "Yes. Create a player account and verify your email to access your profile and account settings.",
  },
];

export default function HomePage() {
  return (
    <>
      <PublicNav />
      <main id="main-content">
        <section className="on-dark relative isolate flex min-h-[31rem] items-center overflow-hidden bg-forest text-white sm:min-h-[36rem]">
          <Image
            src="/images/cricket-hero.webp"
            alt="Cricket players on an outdoor ground at dusk"
            fill
            loading="eager"
            fetchPriority="high"
            sizes="100vw"
            className="-z-20 object-cover object-[62%_50%]"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#071d15e8_0%,#092319af_42%,#09231926_100%)]" />
          <div className="mx-auto w-full max-w-[80rem] px-5 pt-11 pb-21 sm:px-8 lg:px-10">
            <p className="mb-4 flex items-center gap-2 text-sm font-extrabold tracking-[.16em] text-accent uppercase">
              <Flag size={17} aria-hidden="true" /> Cricket turf booking
            </p>
            <h1 className="font-heading text-[clamp(3.25rem,7.4vw,6.6rem)] leading-[.96] font-extrabold tracking-[-.07em]">
              Your Game.
              <br />
              <span className="text-accent">Your Pitch.</span>
            </h1>
            <p className="mt-5 max-w-[32rem] text-lg leading-relaxed text-white/90 sm:text-xl">
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
                className="border-white/50 bg-forest/75 text-white hover:bg-forest"
              >
                <Link href="/register-owner">List Your Turf</Link>
              </Button>
            </div>
          </div>
        </section>

        <div
          id="turf-search"
          className="relative z-10 mx-auto -mt-10 max-w-[69rem] scroll-mt-6 px-5 sm:px-8"
        >
          <TurfPreviewSearch />
        </div>

        <section
          id="turfs"
          className="mx-auto max-w-[80rem] scroll-mt-8 px-5 py-15 sm:px-8 sm:py-19 lg:px-10"
        >
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">
                Featured turfs
              </h2>
              <p className="mt-2 text-muted">
                A preview of how grounds will appear on PitchMate.
              </p>
            </div>
            <Badge>Demonstration listings</Badge>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {turfs.map((turf) => (
              <Card key={turf.name} className="overflow-hidden">
                <div className="relative aspect-[1.65] bg-highlight">
                  <Image
                    alt={turf.alt}
                    src={`/images/${turf.image}.webp`}
                    fill
                    sizes="(max-width: 767px) 92vw, (max-width: 1280px) 30vw, 385px"
                    className="object-cover"
                  />
                  <Badge className="absolute top-3 left-3 border-transparent bg-white text-[#17211c]">
                    {turf.type}
                  </Badge>
                </div>
                <div className="p-4 sm:p-5">
                  <h3 className="text-xl font-extrabold tracking-tight">
                    {turf.name}
                  </h3>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                    <MapPin size={15} aria-hidden="true" />
                    {turf.location}
                  </p>
                  <p className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-4 text-sm text-muted">
                    <span>Sample rate</span>
                    <span>
                      <strong className="text-lg text-foreground">
                        {turf.price}
                      </strong>{" "}
                      / hour
                    </span>
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-4 border-y border-border bg-surface"
        >
          <div className="mx-auto max-w-[80rem] px-5 py-15 sm:px-8 lg:px-10">
            <h2 className="text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">
              How PitchMate works
            </h2>
            <p className="mt-2 text-muted">
              Here’s what match day will look like when reservations open.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {steps.map(({ title, description, icon: Icon }) => (
                <div key={title} className="rounded-2xl bg-background p-6">
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

        <section id="owners" className="on-dark bg-forest text-white">
          <div className="mx-auto grid max-w-[80rem] gap-10 px-5 py-15 sm:px-8 md:grid-cols-[1fr_.8fr] lg:px-10">
            <div>
              <p className="text-sm font-extrabold tracking-[.13em] text-accent uppercase">
                For turf owners
              </p>
              <h2 className="mt-2 text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">
                Give your ground a home.
              </h2>
              <p className="mt-3 max-w-lg text-white/80">
                Create an owner account and submit your business details ahead
                of live turf listings.
              </p>
              <Button asChild variant="accent" className="mt-6">
                <Link href="/register-owner">List Your Turf</Link>
              </Button>
            </div>
            <ul className="grid content-center gap-4 font-semibold">
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
            <Link href="#turfs">Explore turfs</Link>
            <Link href="#faq">FAQ</Link>
            <Link href="/register-owner">For owners</Link>
            <Link href="/login">Log in</Link>
          </nav>
          <p className="text-sm text-muted">
            © {new Date().getUTCFullYear()} PitchMate
          </p>
        </div>
      </footer>
    </>
  );
}
