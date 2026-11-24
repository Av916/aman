"use client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/states";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ErrorState title="Something went wrong">
      <Button onClick={reset}>Try again</Button>
    </ErrorState>
  );
}
