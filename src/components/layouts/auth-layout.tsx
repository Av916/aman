import Image from "next/image";
import { Logo } from "@/components/branding/logo";
import { ThemeToggle } from "@/components/shared/theme-menu";
import { Card } from "@/components/ui/card";

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(32rem,1fr)_minmax(0,.9fr)]">
      <div className="flex flex-col">
        <header className="flex h-[4.5rem] items-center justify-between gap-4 px-5 sm:px-8">
          <Logo />
          <ThemeToggle />
        </header>
        <main
          id="main-content"
          className="grid flex-1 place-items-center px-5 py-8 sm:px-8 lg:py-12"
        >
          <Card className="w-full max-w-[29rem] border-sage/35 px-5 py-7 shadow-lg shadow-forest/5 sm:px-8 sm:py-8">
            <h1 className="text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 mb-6 text-muted">{description}</p>
            {children}
            {footer && (
              <div className="mt-5 grid gap-2 border-t border-border pt-4 text-sm text-muted">
                {footer}
              </div>
            )}
          </Card>
        </main>
      </div>
      <aside className="relative isolate m-3 ml-0 hidden overflow-hidden rounded-[2rem] bg-forest text-cream lg:flex lg:items-end">
        <Image
          src="/images/cricket-hero.webp"
          alt=""
          fill
          loading="eager"
          sizes="48vw"
          className="-z-20 object-cover object-[73%_50%]"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-forest via-forest/65 via-40% to-forest/10" />
        <p className="max-w-md p-10 font-heading text-5xl leading-none font-extrabold tracking-[-.055em] xl:p-14">
          Your Game.
          <br />
          <span className="text-accent">Your Pitch.</span>
        </p>
      </aside>
    </div>
  );
}
