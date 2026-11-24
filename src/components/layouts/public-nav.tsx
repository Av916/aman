import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeMenu } from "@/components/shared/theme-menu";

export function PublicNav() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-[4.5rem] max-w-[83rem] items-center justify-between gap-4 px-5 sm:px-8">
        <Logo />
        <nav
          aria-label="Primary"
          className="hidden items-center gap-8 text-sm font-semibold md:flex"
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
          <ThemeMenu />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="hidden md:inline-flex">
            <Link href="/register">Get started</Link>
          </Button>
          <div className="md:hidden">
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
                  <DialogClose asChild>
                    <Button asChild variant="outline">
                      <Link href="/login">Log in</Link>
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button asChild>
                      <Link href="/register">Get started</Link>
                    </Button>
                  </DialogClose>
                </nav>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </header>
  );
}
