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
      <span className={cn(onSale && "text-signal", className)}>{format(cents)}</span>
      {onSale && (
        <span className={cn("text-muted line-through text-[0.85em]", compareClassName)}>
          {format(compareAt!)}
        </span>
      )}
    </span>
  );
}
