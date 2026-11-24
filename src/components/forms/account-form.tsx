"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { ZodType } from "zod";
import { Button } from "@/components/ui/button";
import {
  changePasswordSchema,
  customerRegistration,
  forgotSchema,
  loginSchema,
  ownerRegistration,
  resendSchema,
  resetSchema,
  verificationSchema,
} from "@/modules/auth/schemas";
import { updateProfileSchema } from "@/modules/users/schemas";
import { Field } from "./field";

type Values = Partial<
  Record<
    | "name"
    | "email"
    | "password"
    | "businessName"
    | "businessPhone"
    | "currentPassword",
    string
  >
> & { phone?: string | null };
type FormField = {
  name: keyof Values;
  label: string;
  type?: "email" | "password" | "tel";
  autoComplete?: string;
};
type FormConfig = {
  fields: FormField[];
  schema: ZodType<Values, Values>;
  label: string;
  endpoint?: string;
  method?: "POST" | "PATCH";
};

const fullName = {
  name: "name",
  label: "Full name",
  autoComplete: "name",
} as const;
const email = {
  name: "email",
  label: "Email address",
  type: "email",
  autoComplete: "email",
} as const;
const existingPassword = {
  name: "password",
  label: "Password",
  type: "password",
  autoComplete: "current-password",
} as const;
const newPassword = {
  name: "password",
  label: "Password",
  type: "password",
  autoComplete: "new-password",
} as const;
const config = {
  login: {
    fields: [email, existingPassword],
    schema: loginSchema,
    label: "Log in",
  },
  register: {
    fields: [fullName, email, newPassword],
    schema: customerRegistration,
    label: "Create player account",
    endpoint: "/api/auth/register",
  },
  "register-owner": {
    fields: [
      fullName,
      email,
      {
        name: "businessName",
        label: "Business name",
        autoComplete: "organization",
      },
      {
        name: "businessPhone",
        label: "Business phone",
        type: "tel",
        autoComplete: "tel",
      },
      newPassword,
    ],
    schema: ownerRegistration,
    label: "Create owner account",
    endpoint: "/api/auth/register-owner",
  },
  "forgot-password": {
    fields: [email],
    schema: forgotSchema,
    label: "Send reset link",
    endpoint: "/api/auth/forgot-password",
  },
  "reset-password": {
    fields: [{ ...newPassword, label: "New password" }],
    schema: resetSchema.omit({ token: true }),
    label: "Reset password",
    endpoint: "/api/auth/reset-password",
  },
  "verify-email": {
    fields: [existingPassword],
    schema: verificationSchema.omit({ token: true }),
    label: "Verify email",
    endpoint: "/api/auth/verify-email",
  },
  "resend-verification": {
    fields: [email, existingPassword],
    schema: resendSchema,
    label: "Send verification link",
    endpoint: "/api/auth/resend-verification",
  },
  profile: {
    fields: [
      fullName,
      {
        name: "phone",
        label: "Phone number (optional)",
        type: "tel",
        autoComplete: "tel",
      },
    ],
    schema: updateProfileSchema,
    label: "Save profile",
    endpoint: "/api/users/me",
    method: "PATCH",
  },
  "change-password": {
    fields: [
      {
        ...existingPassword,
        name: "currentPassword",
        label: "Current password",
      },
      { ...newPassword, label: "New password" },
    ],
    schema: changePasswordSchema,
    label: "Change password",
    endpoint: "/api/users/me/password",
    method: "PATCH",
  },
} satisfies Record<string, FormConfig>;

export type AccountFormMode = keyof typeof config;

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export function AccountForm({
  mode,
  initialValues,
  google = false,
  oauthError = false,
  returnPath,
}: {
  mode: AccountFormMode;
  initialValues?: Values;
  google?: boolean;
  oauthError?: boolean;
  returnPath?: string;
}) {
  const router = useRouter();
  const accountUrl = returnPath
    ? `/account?next=${encodeURIComponent(returnPath)}`
    : "/account";
  const [complete, setComplete] = useState("");
  const [failure, setFailure] = useState(
    oauthError
      ? "Google sign-in could not be completed. If you registered with a password, log in with it."
      : "",
  );
  const [googlePending, setGooglePending] = useState(false);
  const fragment = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => null,
  );
  const token = new URLSearchParams(fragment?.slice(1)).get("token");
  const tokenRequired = mode === "reset-password" || mode === "verify-email";
  const usableToken = !!token && /^[a-f0-9]{64}$/.test(token);
  const settings: FormConfig = config[mode];
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(settings.schema),
    defaultValues: initialValues,
  });

  async function submit(data: Values) {
    setFailure("");
    try {
      if (mode === "login") {
        const result = await signIn("credentials", {
          ...data,
          redirect: false,
          callbackUrl: accountUrl,
        });
        if (result?.ok && !result.error) {
          router.replace(accountUrl);
          return;
        }
        setFailure(
          "Unable to log in. Check your credentials and confirm your email, or try again later.",
        );
        return;
      }

      const response = await fetch(settings.endpoint!, {
        method: settings.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenRequired ? { ...data, token } : data),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setFailure(result.message);
        for (const issue of result.error?.details ?? []) {
          const field = settings.fields.find(
            ({ name }) => name === issue.field,
          );
          if (field) setError(field.name, { message: issue.message });
        }
        return;
      }
      if (mode === "profile") {
        reset({
          name: result.data.user.name,
          phone: result.data.user.phone ?? "",
        });
        toast.success(result.message);
        router.refresh();
        return;
      }
      if (tokenRequired)
        window.history.replaceState(null, "", window.location.pathname);
      reset();
      setComplete(result.message);
    } catch {
      setFailure("PitchMate could not complete your request. Try again.");
    }
  }

  async function googleLogin() {
    setFailure("");
    setGooglePending(true);
    try {
      await signIn("google", { callbackUrl: accountUrl });
    } catch {
      setFailure("Google sign-in could not be started. Try again.");
      setGooglePending(false);
    }
  }

  if (complete)
    return (
      <div className="grid gap-4">
        <p role="status" className="rounded-xl bg-highlight p-4 font-medium">
          {complete}
        </p>
        <Button variant="outline" asChild>
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    );

  if (tokenRequired && fragment === null)
    return (
      <p role="status" className="text-muted">
        Opening your email link…
      </p>
    );
  if (tokenRequired && !usableToken)
    return (
      <div className="grid gap-4">
        <p role="alert" className="text-destructive">
          Open the complete link from your email.
        </p>
        <Button variant="outline" asChild>
          <Link
            href={
              mode === "verify-email"
                ? "/resend-verification"
                : "/forgot-password"
            }
          >
            Request a new link
          </Link>
        </Button>
      </div>
    );

  return (
    <div className="grid gap-4">
      {google && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={googlePending || isSubmitting}
            onClick={googleLogin}
          >
            {googlePending ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : null}{" "}
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-border" />
            or use email
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form
        className="grid gap-4"
        noValidate
        onSubmit={handleSubmit(submit)}
        aria-busy={isSubmitting}
      >
        {settings.fields.map(({ name, ...field }) => (
          <Field
            key={name}
            {...field}
            registration={register(name)}
            error={errors[name]?.message}
          />
        ))}
        {mode === "login" && (
          <Link
            href="/forgot-password"
            className="justify-self-end text-sm font-bold text-brand-dot hover:underline"
          >
            Forgot password?
          </Link>
        )}
        {failure && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
          >
            {failure}
          </p>
        )}
        <Button
          size="lg"
          type="submit"
          disabled={isSubmitting || googlePending}
        >
          {isSubmitting && (
            <LoaderCircle
              size={18}
              className="animate-spin"
              aria-hidden="true"
            />
          )}
          {settings.label}
        </Button>
      </form>
    </div>
  );
}
