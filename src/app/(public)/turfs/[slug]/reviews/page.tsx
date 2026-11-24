import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { PublicNav } from "@/components/layouts/public-nav";
import { VenueReviews } from "@/components/operations/public-reviews";

export const metadata = { title: "Verified venue reviews" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const parsed = z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .safeParse((await searchParams).page ?? 1);
  const page = parsed.success ? parsed.data : 1;
  const actor = await currentUser();
  const listing = await VenueReviews({
    slug,
    canReport: Boolean(actor),
    page,
    standalone: true,
  }).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link className="text-sm font-bold underline" href={`/turfs/${slug}`}>
          Venue details
        </Link>
        {listing}
      </main>
    </>
  );
}
