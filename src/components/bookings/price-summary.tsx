import { money } from "@/components/venues/format";

type Cost = {
  subtotal: number;
  addonTotal: number;
  discountAmount: number;
  platformFee: number;
  taxAmount: number;
  totalAmount: number;
};
export function PriceSummary({
  price,
  label = "Total payable",
}: {
  price: Cost;
  label?: string;
}) {
  const lines = [
    ["Slot subtotal", price.subtotal],
    ["Add-ons", price.addonTotal],
    ["Platform fee", price.platformFee],
    ["Tax", price.taxAmount],
    ["Discount", -price.discountAmount],
  ] as const;
  return (
    <dl className="grid gap-2 text-sm">
      {lines.map(([name, value]) => (
        <div key={name} className="flex justify-between gap-4">
          <dt className="text-muted">{name}</dt>
          <dd className="font-medium">{money(value)}</dd>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-4 border-t border-border pt-3 text-lg font-extrabold">
        <dt>{label}</dt>
        <dd>{money(price.totalAmount)}</dd>
      </div>
    </dl>
  );
}
