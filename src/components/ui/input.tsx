import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl border border-control-border bg-surface px-3.5 text-base placeholder:text-muted",
        className,
      )}
      {...props}
    />
  );
}
