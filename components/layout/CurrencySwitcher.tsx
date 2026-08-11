"use client";

import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { useCurrency } from "@/components/providers/currency-context";
import { CURRENCY_CODES } from "@/lib/money";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);

  return (
    // Sits a gutter above the fixed bottom bar. --bottom-bar-clear already folds in the
    // device's own safe-area inset, so this is the one number to change if the bar resizes.
    <div className="fixed bottom-[calc(1rem+var(--bottom-bar-clear))] start-5 z-30">
      {open && (
        <div className="mb-2 overflow-hidden border border-line bg-paper shadow-lg">
          {CURRENCY_CODES.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCurrency(c);
                setOpen(false);
              }}
              className={cn(
                "block w-full px-4 py-2 text-start text-xs uppercase tracking-wider hover:bg-mist",
                c === currency && "bg-mist font-semibold",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="focus-ring flex items-center gap-2 border border-line bg-paper px-3.5 py-2.5 text-xs font-medium uppercase tracking-wider shadow-sm hover:bg-mist"
      >
        {currency}
        <ChevronUp {...icon.micro} className={cn("transition-transform", !open && "rotate-180")} />
      </button>
    </div>
  );
}
