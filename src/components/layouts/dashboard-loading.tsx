import { Skeleton } from "@/components/ui/skeleton";

export function DashboardLoading() {
  return (
    <main
      id="main-content"
      className="mx-auto grid max-w-6xl gap-6 p-8"
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        Loading dashboard
      </span>
      <Skeleton className="h-12 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </main>
  );
}
