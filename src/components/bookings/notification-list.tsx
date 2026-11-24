"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { venueRequest } from "@/components/venues/api-client";

type Notice = {
  id: string;
  bookingId: string;
  title: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
};
export function Notifications({
  items,
  unread,
}: {
  items: Notice[];
  unread: number;
}) {
  const router = useRouter();
  async function read(id?: string) {
    try {
      await venueRequest(
        id ? `/api/notifications/${id}/read` : "/api/notifications/read-all",
        "PATCH",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update notifications.",
      );
    }
  }
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{unread} unread</p>
        <Button
          variant="outline"
          disabled={!unread}
          onClick={() => void read()}
        >
          Mark all as read
        </Button>
      </div>
      {items.length ? (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border border-border p-4 ${item.readAt ? "bg-surface" : "bg-highlight"}`}
            >
              <h2 className="font-extrabold">{item.title}</h2>
              <p className="mt-1 text-sm text-muted">{item.message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/bookings/${item.bookingId}`}>View booking</Link>
                </Button>
                {!item.readAt && (
                  <Button variant="ghost" onClick={() => void read(item.id)}>
                    Mark as read
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-border bg-surface p-5 text-muted">
          Booking and payment updates will appear here.
        </p>
      )}
    </div>
  );
}
