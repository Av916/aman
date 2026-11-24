import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      className="mx-auto grid max-w-[83rem] gap-6 px-5 py-12"
    >
      <Skeleton className="h-14 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-72" />
        ))}
      </div>
    </main>
  );
}
