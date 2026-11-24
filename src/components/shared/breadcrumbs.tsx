import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {items.map(({ label, href }, index) => (
          <li className="flex items-center gap-2" key={label}>
            {index > 0 && <ChevronRight size={15} aria-hidden="true" />}
            {href ? (
              <Link
                className="hover:text-brand-dot hover:underline"
                href={href}
              >
                {label}
              </Link>
            ) : (
              <span aria-current="page" className="font-bold text-foreground">
                {label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
