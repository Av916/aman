import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/forms/account-form";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Log in" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthLayout
      title="Welcome back"
      description="Log in to your PitchMate account."
      footer={
        <>
          <p>
            New to PitchMate?{" "}
            <Link
              className="font-bold text-brand-dot hover:underline"
              href="/register"
            >
              Create an account
            </Link>
          </p>
          <Link
            className="font-bold text-brand-dot hover:underline"
            href="/resend-verification"
          >
            Resend email verification
          </Link>
        </>
      }
    >
      <AccountForm
        mode="login"
        google={Boolean(getEnv().AUTH_GOOGLE_ID)}
        oauthError={Boolean(error)}
      />
    </AuthLayout>
  );
}
