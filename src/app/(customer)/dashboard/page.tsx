import type { Metadata } from "next";
import { Dashboard } from "@/components/layouts/dashboard";

export const metadata: Metadata = { title: "Player dashboard" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  return <Dashboard role="CUSTOMER" section={section} />;
}
