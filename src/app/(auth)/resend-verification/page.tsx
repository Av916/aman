import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/forms/account-form";
import { AuthLayout } from "@/components/layouts/auth-layout";

export const metadata: Metadata = { title: "Resend email verification" };
export default function Page() {
  return (
    <AuthLayout
      title="Resend email verification"
      description="Enter the email address and password you used to register."
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
      <AccountForm mode="resend-verification" />
    </AuthLayout>
  );
}
