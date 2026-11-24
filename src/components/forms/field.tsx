"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";

type Props = {
  label: string;
  type?: "text" | "password" | "email" | "tel";
  autoComplete?: string;
  registration: UseFormRegisterReturn;
  error?: string;
};

export function Field({
  label,
  type = "text",
  autoComplete,
  registration,
  error,
}: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <div className="relative">
        <Input
          {...registration}
          id={id}
          type={isPassword && visible ? "text" : type}
          autoComplete={autoComplete}
          className={isPassword ? "pr-14" : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {isPassword && (
          <button
            className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-md text-muted hover:text-foreground"
            type="button"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-controls={id}
          >
            {visible ? (
              <EyeOff size={19} aria-hidden="true" />
            ) : (
              <Eye size={19} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="text-sm font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
