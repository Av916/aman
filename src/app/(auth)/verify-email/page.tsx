import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/forms/account-form";
import { AuthLayout } from "@/components/layouts/auth-layout";

export const metadata: Metadata = { title: "Verify your email" };
export default function Page() {
  return (
    <AuthLayout
      title="Verify your email"
      description="Confirm the password you chose when you registered to activate your PitchMate account."
      footer={
        <>
          <p>
            {" "}
            <Link
              className="font-bold text-brand-dot hover:underline"
              href="/resend-verification"
            >
              Request another verification link
            </Link>
          </p>
        </>
      }
    >
      <AccountForm mode="verify-email" />
    </AuthLayout>
  );
}
