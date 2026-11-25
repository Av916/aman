"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function Logout() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      className="shrink-0 px-3"
      aria-label={loading ? "Signing out…" : "Log out"}
      title="Log out"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await signOut({ callbackUrl: "/" });
        } catch {
          toast.error("Unable to sign out. Try again.");
          setLoading(false);
        }
      }}
    >
      <LogOut size={16} aria-hidden="true" />
      <span className="hidden sm:inline">
        {loading ? "Signing out…" : "Log out"}
      </span>
    </Button>
  );
}
