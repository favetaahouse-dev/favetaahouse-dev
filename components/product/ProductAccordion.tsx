"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProductDetailDTO } from "./ProductDetail";

export function ProductAccordion({ product }: { product: ProductDetailDTO }) {
  const t = useTranslations("product");
  const items = [
    { key: "productCode", value: product.productCode },
    { key: "description", value: product.description },
    { key: "materials", value: product.materials },
    { key: "modelSize", value: product.modelSize },
    { key: "details", value: product.details },
    { key: "packaging", value: product.packaging },
  ].filter((i) => i.value);

  const [open, setOpen] = useState<string | null>(items[0]?.key ?? null);

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      {items.map((item) => {
        const isOpen = open === item.key;
        return (
          <div key={item.key} className="border-b border-line">
            <button
              onClick={() => setOpen(isOpen ? null : item.key)}
              className="flex w-full items-center justify-between py-4 text-start transition-colors hover:text-signal"
            >
              <span className="font-button text-[11px] uppercase tracking-[0.14em]">{t(item.key)}</span>
              {isOpen ? <Minus size={15} /> : <Plus size={15} />}
            </button>
            <div
              className={`grid transition-all duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="whitespace-pre-line pb-4 text-sm leading-relaxed text-ink/75">{item.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
