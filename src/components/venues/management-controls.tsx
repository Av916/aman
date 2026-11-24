"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { venueRequest } from "./api-client";

export const choiceClass =
  "min-h-11 w-full rounded-xl border border-control-border bg-surface px-3";
export const panelClass =
  "rounded-2xl border border-border bg-surface p-4 sm:p-6";
export const fieldClass = "grid min-w-0 gap-1 text-sm font-bold";

export function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={fieldClass}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function TextField({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <FormField label={label}>
      <Input {...props} />
    </FormField>
  );
}

export function useManagementRequest() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run<T>(
    action: () => Promise<T>,
    message: string,
    completed?: (value: T) => void,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = await action();
      if (completed) completed(value);
      else router.refresh();
      toast.success(message);
    } catch (problem) {
      const message =
        problem instanceof Error
          ? problem.message
          : "Could not complete the action.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error };
}

export function FormError({ error }: { error: string }) {
  return error ? (
    <p
      role="alert"
      className="rounded-xl border border-destructive/50 bg-background p-3 text-sm text-destructive"
    >
      {error}
    </p>
  ) : null;
}

export function ConfirmAction({
  label,
  description,
  path,
  method = "POST",
  payload,
  success,
  onDone,
}: {
  label: string;
  description: string;
  path: string;
  method?: string;
  payload?: object;
  success: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { run, busy, error } = useManagementRequest();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent title={label} description={description}>
        <FormError error={error} />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () => venueRequest(path, method, payload),
                success,
                () => {
                  setOpen(false);
                  if (onDone) onDone();
                  else router.refresh();
                },
              )
            }
          >
            {busy ? "Working…" : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
export const value = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
export const number = (data: FormData, name: string) =>
  Number(value(data, name));
export const nullable = (data: FormData, name: string) =>
  value(data, name) || null;
export const fromClock = (clock: string) => {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
};
