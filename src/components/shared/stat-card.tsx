import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <Card className="p-5">
      <span className="mb-4 grid size-10 place-items-center rounded-xl bg-highlight text-brand-dot">
        <Icon size={19} aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 font-heading text-2xl font-extrabold tracking-tight">
        {value}
      </p>
    </Card>
  );
}
