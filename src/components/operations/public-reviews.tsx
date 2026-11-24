import Link from "next/link";
import { publicReviews } from "@/modules/reviews/service";
import { PublicReviewReport } from "./review-workspace";

export async function VenueReviews({
  slug,
  canReport,
  page = 1,
  standalone = false,
}: {
  slug: string;
  canReport: boolean;
  page?: number;
  standalone?: boolean;
}) {
  const { total, average, reviews, distribution } = await publicReviews(
    slug,
    page,
  );
  return (
    <section
      id="reviews"
      aria-label="Verified customer reviews"
      className="mt-8 rounded-2xl border border-border bg-surface p-5"
    >
      <h2 className="mb-2 text-2xl font-bold">Verified reviews</h2>
      {average === null ? (
        <p className="text-sm text-muted">No published reviews yet.</p>
      ) : (
        <>
          <p className="text-lg font-semibold">
            {average.toFixed(1)} out of 5 · {total}{" "}
            {total === 1 ? "review" : "reviews"}
          </p>
          <dl className="mt-3 flex flex-wrap gap-2 text-sm">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="rounded-md bg-background px-2 py-1">
                <dt className="inline">{rating} stars</dt>{" "}
                <dd className="inline font-bold">
                  {distribution.find((item) => item.rating === rating)
                    ?._count ?? 0}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 divide-y divide-border">
            {reviews.map((review) => (
              <article key={review.id} className="grid gap-2 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-bold">{review.rating} out of 5</p>
                  <span className="text-xs text-muted">Verified booking</span>
                  {canReport && <PublicReviewReport id={review.id} />}
                </div>
                {review.comment && <p className="text-sm">{review.comment}</p>}
                {review.ownerResponse && (
                  <blockquote className="border-l-2 border-primary pl-3 text-sm">
                    <strong className="block">Venue response</strong>
                    {review.ownerResponse}
                  </blockquote>
                )}
              </article>
            ))}
          </div>
          {!standalone && total > reviews.length && (
            <Link className="text-sm underline" href={`/turfs/${slug}/reviews`}>
              See all reviews
            </Link>
          )}
          {standalone && (
            <nav
              aria-label="Review pages"
              className="flex gap-4 text-sm font-bold"
            >
              {page > 1 && (
                <Link className="underline" href={`?page=${page - 1}`}>
                  Previous
                </Link>
              )}
              {page * 12 < total && (
                <Link className="underline" href={`?page=${page + 1}`}>
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
