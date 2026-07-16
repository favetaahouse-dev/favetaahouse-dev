"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n-navigation";
import type { SortKey, CollectionFacets } from "@/lib/data/collections";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "featured" },
  { key: "best-selling", label: "bestSelling" },
  { key: "title-ascending", label: "aToZ" },
  { key: "title-descending", label: "zToA" },
  { key: "price-ascending", label: "priceLow" },
  { key: "price-descending", label: "priceHigh" },
  { key: "created-descending", label: "newest" },
];

export function CollectionToolbar({
  total,
  priceMax,
  facets,
}: {
  total: number;
  priceMax: number;
  facets: CollectionFacets;
}) {
  const t = useTranslations("collection");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const currentSort = (sp.get("sort") as SortKey) || "featured";
  const inStock = sp.get("inStock") === "1";
  const activeColor = sp.get("color");
  const activeMaterial = sp.get("material");
  const maxPriceQar = Math.round(priceMax / 100);

  const activeCount =
    (inStock ? 1 : 0) +
    (activeColor ? 1 : 0) +
    (activeMaterial ? 1 : 0) +
    (sp.get("min") || sp.get("max") ? 1 : 0);

  function apply(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    apply({ inStock: null, color: null, material: null, min: null, max: null });
  }

  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3 md:px-8">
      <div className="relative">
        <button
          onClick={() => setFilterOpen((o) => !o)}
          className="flex items-center gap-2 font-button text-[11px] uppercase tracking-[0.14em]"
        >
          <SlidersHorizontal size={15} /> {t("filter")}
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-medium text-white">
              {activeCount}
            </span>
          )}
        </button>
        {filterOpen && (
          <div className="absolute start-0 top-full z-30 mt-2 max-h-[72vh] w-72 overflow-y-auto border border-line bg-paper p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-button text-[11px] uppercase tracking-[0.14em]">{t("filter")}</span>
              <button onClick={() => setFilterOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => apply({ inStock: e.target.checked ? "1" : null })}
                className="h-4 w-4 accent-ink"
              />
              {t("inStock")}
            </label>

            {facets.colors.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs uppercase tracking-wider text-muted">{t("color")}</p>
                <div className="flex flex-wrap gap-2">
                  {facets.colors.map((c) => {
                    const active = activeColor === c.color;
                    return (
                      <button
                        key={c.color}
                        onClick={() => apply({ color: active ? null : c.color })}
                        title={`${c.color} (${c.count})`}
                        aria-label={`${c.color} (${c.count})`}
                        aria-pressed={active}
                        className={cn(
                          "h-6 w-6 rounded-full border border-line transition",
                          active && "ring-2 ring-ink ring-offset-1",
                        )}
                        style={{ backgroundColor: c.hex ?? "var(--color-cream)" }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {facets.materials.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs uppercase tracking-wider text-muted">{t("fabric")}</p>
                <div className="flex flex-wrap gap-2">
                  {facets.materials.map((m) => {
                    const active = activeMaterial === m.value;
                    return (
                      <button
                        key={m.value}
                        onClick={() => apply({ material: active ? null : m.value })}
                        aria-pressed={active}
                        className={cn(
                          "border px-3 py-1 text-[11px] tracking-wide transition",
                          active ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                        )}
                      >
                        {m.label} <span className="text-muted">({m.count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted">{t("price")}</p>
              <PriceInputs
                maxPriceQar={maxPriceQar}
                minVal={sp.get("min")}
                maxVal={sp.get("max")}
                onApply={(min, max) => apply({ min, max })}
                applyLabel={t("apply")}
                clearLabel={t("clear")}
                onClear={() => apply({ min: null, max: null })}
              />
            </div>

            {activeCount > 0 && (
              <button
                onClick={clearAll}
                className="mt-5 w-full border border-line py-2 text-[11px] uppercase tracking-wider hover:border-ink"
              >
                {t("clearAll")}
              </button>
            )}
          </div>
        )}
      </div>

      <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {t("results", { count: total })}
      </span>

      <div className="relative">
        <button
          onClick={() => setSortOpen((o) => !o)}
          className="flex items-center gap-2 font-button text-[11px] uppercase tracking-[0.14em]"
        >
          {t("sortBy")} <ChevronDown size={14} />
        </button>
        {sortOpen && (
          <div className="absolute end-0 top-full z-30 mt-2 w-56 border border-line bg-paper py-2 shadow-lg">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => {
                  apply({ sort: o.key === "featured" ? null : o.key });
                  setSortOpen(false);
                }}
                className={cn(
                  "block w-full px-4 py-2 text-start text-xs hover:bg-cream",
                  currentSort === o.key && "font-semibold text-gold",
                )}
              >
                {t(o.label)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceInputs({
  maxPriceQar,
  minVal,
  maxVal,
  onApply,
  onClear,
  applyLabel,
  clearLabel,
}: {
  maxPriceQar: number;
  minVal: string | null;
  maxVal: string | null;
  onApply: (min: string | null, max: string | null) => void;
  onClear: () => void;
  applyLabel: string;
  clearLabel: string;
}) {
  const [min, setMin] = useState(minVal ?? "");
  const [max, setMax] = useState(maxVal ?? "");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={min}
          min={0}
          placeholder="0"
          onChange={(e) => setMin(e.target.value)}
          className="w-full border border-line px-2 py-1.5 text-sm outline-none focus:border-ink focus:shadow-[inset_0_-2px_0_var(--color-gold)]"
        />
        <span>–</span>
        <input
          type="number"
          value={max}
          placeholder={String(maxPriceQar)}
          onChange={(e) => setMax(e.target.value)}
          className="w-full border border-line px-2 py-1.5 text-sm outline-none focus:border-ink focus:shadow-[inset_0_-2px_0_var(--color-gold)]"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onApply(min || null, max || null)}
          className="flex-1 bg-ink py-2 text-[11px] uppercase tracking-wider text-white"
        >
          {applyLabel}
        </button>
        <button onClick={onClear} className="flex-1 border border-line py-2 text-[11px] uppercase tracking-wider">
          {clearLabel}
        </button>
      </div>
    </div>
  );
}
