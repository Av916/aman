"use client";
import { Avatar as Primitive } from "radix-ui";
export function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <Primitive.Root
      className="grid size-10 shrink-0 place-items-center rounded-full bg-highlight text-sm font-bold text-foreground"
      aria-hidden="true"
    >
      <Primitive.Fallback>{initials}</Primitive.Fallback>
    </Primitive.Root>
  );
}
