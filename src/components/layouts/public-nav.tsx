import Link from "next/link";
import { Menu, PanelsTopLeft } from "lucide-react";
import { Suspense } from "react";
import { Logo } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Logout } from "@/components/shared/logout";
import { ThemeToggle } from "@/components/shared/theme-menu";
import { dashboardPath } from "@/config/navigation";
import { currentUser } from "@/lib/auth";

async function AccountLinks({ mobileMenu = false }: { mobileMenu?: boolean }) {
  const user = await currentUser();
  if (mobileMenu) {
    return user ? null : (
      <DialogClose asChild>
        <Button asChild>
          <Link href="/register">Get started</Link>
        </Button>
      </DialogClose>
    );
  }
  if (user) {
    return (
      <>
        <Button asChild variant="ghost" className="shrink-0 px-3">
          <Link href={dashboardPath[user.role]} aria-label="Dashboard">
            <PanelsTopLeft size={18} aria-hidden />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </Button>
        <Logout />
      </>
    );
  }
  return (
    <>
      <Button asChild variant="ghost" className="shrink-0 px-3">
        <Link href="/login">Log in</Link>
      </Button>
      <Button asChild className="hidden md:inline-flex">
        <Link href="/register">Get started</Link>
      </Button>
    </>
  );
}

export function PublicNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[4.5rem] max-w-[83rem] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-8">
        <Logo />
        <nav
          aria-label="Primary"
          className="hidden items-center gap-4 text-sm font-semibold lg:flex lg:gap-7"
        >
          <Link href="/turfs" className="hover:text-brand-dot">
            Explore turfs
          </Link>
          <Link href="/#how-it-works" className="hover:text-brand-dot">
            How it works
          </Link>
          <Link href="/#owners" className="hover:text-brand-dot">
            For owners
          </Link>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Suspense fallback={null}>
            <AccountLinks />
          </Suspense>
          <div className="lg:hidden">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation"
                >
                  <Menu size={22} />
                </Button>
              </DialogTrigger>
              <DialogContent
                title="PitchMate"
                description="Explore the site or access your account."
              >
                <nav aria-label="Mobile primary" className="grid gap-2">
                  <DialogClose asChild>
                    <Link
                      href="/turfs"
                      className="rounded-lg p-2 hover:bg-background"
                    >
                      Explore turfs
                    </Link>
                  </DialogClose>
                  <DialogClose asChild>
                    <Link
                      href="/#how-it-works"
                      className="rounded-lg p-2 hover:bg-background"
                    >
                      How it works
                    </Link>
                  </DialogClose>
                  <DialogClose asChild>
                    <Link
                      href="/#owners"
                      className="rounded-lg p-2 hover:bg-background"
                    >
                      For owners
                    </Link>
                  </DialogClose>
                  <Suspense fallback={null}>
                    <AccountLinks mobileMenu />
                  </Suspense>
                </nav>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </header>
  );
}
