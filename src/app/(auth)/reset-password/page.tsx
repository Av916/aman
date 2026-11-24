import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/forms/account-form";
import { AuthLayout } from "@/components/layouts/auth-layout";

export const metadata: Metadata = { title: "Reset your password" };
export default function Page() {
  return (
    <AuthLayout
      title="Reset your password"
      description="Choose a new password with at least 12 characters."
      footer={
        <>
          <p>
            {" "}
            <Link
              className="font-bold text-brand-dot hover:underline"
              href="/forgot-password"
            >
              Request another reset link
            </Link>
          </p>
        </>
      }
    >
      <AccountForm mode="reset-password" />
    </AuthLayout>
  );
}
