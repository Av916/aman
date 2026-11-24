import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="PitchMate home"
      className={cn("inline-flex shrink-0 items-center gap-2.5", className)}
    >
      <Image src="/logo/mark.svg" width={37} height={37} alt="" />
      <span className="font-heading text-[1.38rem] leading-none font-extrabold tracking-[-.06em]">
        PitchMate<span className="text-brand-dot">.</span>
      </span>
    </Link>
  );
}
