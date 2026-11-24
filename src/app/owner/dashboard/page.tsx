import type { Metadata } from "next";
import { Dashboard } from "@/components/layouts/dashboard";

export const metadata: Metadata = { title: "Owner dashboard" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  return <Dashboard role="OWNER" section={section} />;
}
