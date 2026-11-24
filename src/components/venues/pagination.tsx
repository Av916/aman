import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Pagination({
  href,
  params,
  page,
  pages,
}: {
  href: string;
  params: string;
  page: number;
  pages: number;
}) {
  if (pages <= 1 && page <= 1) return null;
  function url(value: number) {
    const query = new URLSearchParams(params);
    query.set("page", String(value));
    return `${href}?${query}`;
  }
  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      {page > 1 && (
        <Button asChild variant="outline">
          <Link href={url(Math.min(page - 1, Math.max(1, pages)))}>
            Previous page
          </Link>
        </Button>
      )}
      <span className="text-sm text-muted">
        Page {page} of {Math.max(1, pages)}
      </span>
      {page < pages && (
        <Button asChild variant="outline">
          <Link href={url(page + 1)}>Next page</Link>
        </Button>
      )}
    </nav>
  );
}
