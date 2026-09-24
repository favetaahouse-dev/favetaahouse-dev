"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import { ProductGridClient } from "@/components/product/ProductGridClient";
import type { ProductCardDTO } from "@/lib/data/catalog";
import type { NavItem } from "@/lib/data/navigation";

/** How many cards a filter shows before "load more", and how many each press adds. */
const PAGE = 6;

/**
 * The homepage's catalogue section: one title, a category filter under it, and a grid.
 *
 * The filter is "All" plus the categories that actually have pieces — the caller passes only
 * those, so a category with nothing in it never gets a button. Single-choice toggle buttons
 * (aria-pressed) rather than tabs: this narrows one grid, it does not switch between panels.
 *
 * Every piece arrives in the initial payload (one pooled query — see getNewArrivals), so
 * filtering is instant and offline-safe: no fetch, no spinner, no skeleton that shifts the
 * page. The trade is a larger first payload, which is the right side of that trade here.
 *
 * "Load more" reveals from what is already here rather than paging the server, so it can
 * never fail. Once a filter is exhausted the button is replaced by a link into the full
 * collection, which is the honest next step.
 */
export function TrendyTabs({
  title,
  products,
  categories,
}: {
  title: string;
  products: ProductCardDTO[];
  categories: NavItem[];
}) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const tcol = useTranslations("collection");
  // null is "All". A key that goes stale — a revalidation can drop a category out from under
  // this state — resolves to no match, which is All again rather than an empty grid.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);

  if (products.length === 0) return null;

  const active = categories.find((c) => c.key === activeKey) ?? null;
  const filtered = active ? products.filter((p) => p.category === active.value) : products;
  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  function select(key: string | null) {
    setActiveKey(key);
    // A filter you have never opened should start at the top of its list, not inherit
    // however far you scrolled the previous one.
    setVisible(PAGE);
  }

  const filterButton = "tab-label focus-ring shrink-0 whitespace-nowrap";

  return (
    <section className="px-4 pt-[70px] pb-[90px] md:px-8">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="section-title">{title}</h2>

        {categories.length > 0 && (
          <div
            role="group"
            aria-label={t("filterBy")}
            // Scrollable rather than wrapping: with six categories on a 390pt screen a
            // wrapped row becomes three ragged lines above the grid.
            className="no-scrollbar mt-6 flex justify-start gap-7 overflow-x-auto md:justify-center"
          >
            <button
              type="button"
              aria-pressed={active === null}
              onClick={() => select(null)}
              className={filterButton}
            >
              {t("all")}
            </button>
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                aria-pressed={active?.key === category.key}
                onClick={() => select(category.key)}
                className={filterButton}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}

        {/* The pressed state says which filter is on; this says what it did to the grid. */}
        <p className="sr-only" aria-live="polite">
          {tcol("results", { count: filtered.length })}
        </p>

        <div className="mt-10">
          <ProductGridClient products={shown} />
        </div>

        <div className="mt-12 text-center">
          {hasMore ? (
            <button
              onClick={() => setVisible((n) => n + PAGE)}
              className="focus-ring font-button text-[13px] tracking-[0.16em] text-muted uppercase transition-colors hover:text-strong"
            >
              {t("loadMore")}
            </button>
          ) : (
            <Link
              href={active?.href ?? "/collections/all"}
              className="focus-ring font-button text-[13px] tracking-[0.16em] text-muted uppercase transition-colors hover:text-strong"
            >
              {tc("backToShop")}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
