"use client";

import { useCurrency } from "@/components/providers/currency-context";
import { cn } from "@/lib/utils";

export function Price({
  cents,
  compareAt,
  className,
  compareClassName,
}: {
  cents: number;
  compareAt?: number | null;
  className?: string;
  compareClassName?: string;
}) {
  const { format } = useCurrency();
  const onSale = compareAt != null && compareAt > cents;
  return (
    <span className="inline-flex items-baseline gap-2">
      {/* A reduced price used to be red. With no accent colour left, weight carries it:
          the live price goes medium and black against the struck-through original, which
          is the pairing that actually communicates the discount anyway. */}
      <span className={cn(onSale && "font-medium text-strong", className)}>{format(cents)}</span>
      {onSale && (
        <span className={cn("text-muted line-through text-[0.85em]", compareClassName)}>
          {format(compareAt!)}
        </span>
      )}
    </span>
  );
}
