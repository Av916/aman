import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/forms/account-form";
import { AuthLayout } from "@/components/layouts/auth-layout";

export const metadata: Metadata = { title: "Create your account" };
export default function Page() {
  return (
    <AuthLayout
      title="Create your account"
      description="Join PitchMate as a player. Use at least 12 characters for your password."
      footer={
        <>
          <p>
            Already have an account?{" "}
            <Link
              className="font-bold text-brand-dot hover:underline"
              href="/login"
            >
              Log in
            </Link>
          </p>
          <p>
            Manage a cricket facility?{" "}
            <Link
              className="font-bold text-brand-dot hover:underline"
              href="/register-owner"
            >
              Create an owner account
            </Link>
          </p>
        </>
      }
    >
      <AccountForm mode="register" />
    </AuthLayout>
  );
}
