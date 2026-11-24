"use client";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-black/55" />
      <Primitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[min(92vw,27rem)] -translate-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl",
          className,
        )}
      >
        <Primitive.Title className="pr-10 text-xl font-extrabold">
          {title}
        </Primitive.Title>
        <Primitive.Description className="mt-2 text-sm text-muted">
          {description}
        </Primitive.Description>
        <Primitive.Close asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3"
            aria-label="Close"
          >
            <X size={19} />
          </Button>
        </Primitive.Close>
        <div className="mt-4">{children}</div>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
