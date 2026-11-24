"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { venueRequest } from "./api-client";

export function FavoriteButton({
  id,
  name,
  initial,
  role,
  refresh = false,
}: {
  id: string;
  name: string;
  initial: boolean;
  role?: string;
  refresh?: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  if (role && role !== "CUSTOMER") return null;
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      aria-label={
        saved ? `Remove ${name} from favorites` : `Save ${name} to favorites`
      }
      aria-pressed={saved}
      disabled={busy}
      onClick={async () => {
        if (!role) {
          router.push(
            `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
          );
          return;
        }
        setBusy(true);
        setSaved(!saved);
        try {
          await (saved
            ? venueRequest(`/api/favorites/${id}`, "DELETE")
            : venueRequest("/api/favorites", "POST", { venueId: id }));
          toast.success(
            saved ? "Removed from favorites." : "Saved to favorites.",
          );
          if (refresh) router.refresh();
        } catch (error) {
          setSaved(saved);
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not update favorites.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <Heart
        size={18}
        className={saved ? "fill-current text-destructive" : ""}
        aria-hidden
      />
    </Button>
  );
}
