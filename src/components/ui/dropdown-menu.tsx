"use client";
import { DropdownMenu as Primitive } from "radix-ui";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export function DropdownMenuContent({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        align="end"
        sideOffset={8}
        className="z-40 min-w-36 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
      >
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
export function DropdownMenuItem({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Primitive.Item
      onSelect={onSelect}
      className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none data-highlighted:bg-background"
    >
      {children}
    </Primitive.Item>
  );
}
