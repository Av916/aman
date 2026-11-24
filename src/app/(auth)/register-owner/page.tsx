import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/forms/account-form";
import { AuthLayout } from "@/components/layouts/auth-layout";

export const metadata: Metadata = { title: "Register as a turf owner" };
export default function Page() {
  return (
    <AuthLayout
      title="Register as a turf owner"
      description="Submit your business details to start owner verification. Use at least 12 characters for your password."
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
            Here to play?{" "}
            <Link
              className="font-bold text-brand-dot hover:underline"
              href="/register"
            >
              Create a player account
            </Link>
          </p>
        </>
      }
    >
      <AccountForm mode="register-owner" />
    </AuthLayout>
  );
}
