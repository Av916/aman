import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, MapPin, Search } from "lucide-react";

export function TurfSearch({ cities }: { cities: { city: string }[] }) {
  return (
    <form
      action="/turfs"
      className="grid gap-3 rounded-2xl border border-border bg-surface p-3 shadow-xl sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:p-4"
    >
      <label className="grid gap-1 rounded-xl bg-background p-2.5 text-sm font-bold">
        <span className="flex items-center gap-2">
          <MapPin size={17} className="text-brand-dot" aria-hidden /> Location
        </span>
        <select
          name="city"
          className="min-h-11 rounded-xl border border-control-border bg-surface px-3 text-sm"
        >
          <option value="">All cities</option>
          {cities.map(({ city }) => (
            <option key={city}>{city}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 rounded-xl bg-background p-2.5 text-sm font-bold">
        <span className="flex items-center gap-2">
          <CalendarDays size={17} className="text-brand-dot" aria-hidden /> Play
          date
        </span>
        <Input name="date" type="date" />
      </label>
      <Button type="submit" size="lg">
        <Search size={18} aria-hidden /> Search turfs
      </Button>
    </form>
  );
}
