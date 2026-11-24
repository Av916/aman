import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/forms/account-form";
import { AuthLayout } from "@/components/layouts/auth-layout";

export const metadata: Metadata = { title: "Forgot your password?" };
export default function Page() {
  return (
    <AuthLayout
      title="Forgot your password?"
      description="Enter the email address you use for PitchMate."
      footer={
        <>
          <p>
            {" "}
            <Link
              className="font-bold text-brand-dot hover:underline"
              href="/login"
            >
              Back to login
            </Link>
          </p>
        </>
      }
    >
      <AccountForm mode="forgot-password" />
    </AuthLayout>
  );
}
