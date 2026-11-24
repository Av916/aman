"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { venueRequest } from "@/components/venues/api-client";

export function StatusPoll({
  id,
  status,
  refunds,
  paymentStatus,
}: {
  id: string;
  status: string;
  refunds: string;
  paymentStatus: string | null;
}) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      void venueRequest<{
        status: string;
        paymentStatus: string | null;
        refunds: { status: string }[];
      }>(`/api/bookings/${id}/status`)
        .then((result) => {
          if (
            result.status !== status ||
            result.paymentStatus !== paymentStatus ||
            result.refunds.map((item) => item.status).join(",") !== refunds
          )
            router.refresh();
        })
        .catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, [id, status, paymentStatus, refunds, router]);
  return (
    <p role="status" className="text-sm text-muted">
      Checking for status updates.
    </p>
  );
}
