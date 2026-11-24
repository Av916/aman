import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/states";

export default function NotFound() {
  return (
    <ErrorState title="Page not found">
      <Button asChild>
        <Link href="/">Back to PitchMate</Link>
      </Button>
    </ErrorState>
  );
}
