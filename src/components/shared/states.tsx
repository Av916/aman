import { CircleAlert, Inbox, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <Card className="grid min-h-56 place-items-center p-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-highlight text-brand-dot">
          <Icon size={22} aria-hidden="true" />
        </span>
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="mt-2 text-muted">{description}</p>
      </div>
    </Card>
  );
}

export function ErrorState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="grid min-h-[70vh] place-items-center p-6 text-center"
    >
      <div className="max-w-md">
        <CircleAlert size={32} className="mx-auto mb-4 text-destructive" />
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </main>
  );
}
