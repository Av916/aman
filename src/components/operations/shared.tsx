"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { venueRequest } from "@/components/venues/api-client";

export type Json<T> = T extends Date
  ? string
  : T extends Array<infer V>
    ? Json<V>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;

export const inputClass =
  "min-h-10 min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm";
export const panelClass =
  "rounded-2xl border border-border bg-surface p-4 sm:p-5";
export const gridClass = "grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4";
export const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    amount / 100,
  );
export const readable = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
export const formatTime = (
  value: string,
  timeZone: string,
  includeDay = false,
) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone,
    ...(includeDay ? { dateStyle: "medium" } : {}),
    timeStyle: "short",
  }).format(new Date(value));
export const dayAt = (value: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
export const dayOffset = (value: string, days: number) => {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

export function paymentBadge(row: {
  status: string;
  confirmedPayment: { status: string } | null;
  _count: { allocations: number };
}) {
  if (row.confirmedPayment) return row.confirmedPayment.status;
  if (row._count.allocations) return "CAPTURED";
  if (row.status === "PENDING_PAYMENT") return "PENDING_PAYMENT";
  if (["CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW"].includes(row.status))
    return "UNPAID";
  return "NO_PAYMENT";
}

const statusTone: Record<string, string> = {
  CONFIRMED: "bg-highlight text-foreground",
  COMPLETED: "bg-highlight text-foreground",
  PENDING_PAYMENT: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  HELD: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  CHECKED_IN: "bg-blue-500/15 text-blue-800 dark:text-blue-100",
  CANCELLED: "bg-rose-500/15 text-rose-900 dark:text-rose-100",
  NO_SHOW: "bg-orange-500/15 text-orange-900 dark:text-orange-100",
};
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[value] ?? "bg-background text-muted"}`}
    >
      {readable(value)}
    </span>
  );
}

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-label={title}
      className="fixed inset-x-0 bottom-0 m-0 max-h-[90dvh] w-full max-w-none overflow-auto rounded-t-2xl border border-border bg-surface p-5 text-foreground backdrop:bg-black/55 sm:inset-0 sm:m-auto sm:max-w-2xl sm:rounded-2xl"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      {children}
    </dialog>
  );
}

export function useOperation<T>(url: string, interval?: number) {
  const [state, setState] = useState<{
    url: string;
    data?: T;
    error?: string;
  }>();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!url) return;
    let active = true;
    async function load() {
      try {
        const data = await venueRequest<T>(url);
        if (active) setState({ url, data });
      } catch (error) {
        if (active)
          setState({
            url,
            error: error instanceof Error ? error.message : "Request failed.",
          });
      }
    }
    void load();
    const timer = interval
      ? setInterval(() => void load(), interval)
      : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [url, interval, refresh]);
  return {
    data: state?.url === url ? state.data : undefined,
    error: state?.url === url ? state.error : undefined,
    reload: () => setRefresh((value) => value + 1),
  };
}

export function LoadState({ error }: { error?: string }) {
  return error ? (
    <p
      role="alert"
      className="rounded-xl border border-destructive/35 p-4 text-destructive"
    >
      {error}
    </p>
  ) : (
    <div
      aria-busy="true"
      aria-label="Loading"
      role="status"
      className="h-36 rounded-xl border border-border bg-surface motion-safe:animate-pulse"
    />
  );
}

export function ActionForm({
  submit,
  children,
  label = "Save",
  disabled = false,
}: {
  submit: (data: FormData) => Promise<void>;
  children?: ReactNode;
  label?: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState({
    busy: false,
    message: "",
    error: false,
  });
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.busy || disabled) return;
    const data = new FormData(event.currentTarget);
    setState({ busy: true, message: "", error: false });
    try {
      await submit(data);
      setState({ busy: false, message: "Saved.", error: false });
    } catch (error) {
      setState({
        busy: false,
        message: error instanceof Error ? error.message : "Request failed.",
        error: true,
      });
    }
  }
  return (
    <form onSubmit={run} className="grid gap-3">
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={state.busy || disabled}>
          {state.busy ? "Saving…" : label}
        </Button>
        <p
          role={state.error ? "alert" : "status"}
          className={
            state.error ? "text-sm text-destructive" : "text-sm text-muted"
          }
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}

export function SimpleTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  if (!rows.length)
    return <p className={panelClass}>No records match these filters.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-background">
          <tr>
            {columns.map((column, i) => (
              <th
                key={i}
                scope="col"
                className="whitespace-nowrap px-3 py-3 font-semibold"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((item, j) => (
                <td key={j} className="px-3 py-3">
                  {item}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
