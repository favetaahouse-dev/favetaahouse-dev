"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import { ProductGridClient } from "@/components/product/ProductGridClient";
import { EAGER_CARDS } from "@/components/product/ProductCardView";
import type { ProductCardDTO } from "@/lib/data/catalog";
import type { NavItem } from "@/lib/data/navigation";

/** How many cards a filter shows before "load more", and how many each press adds. */
const PAGE = 6;

/**
 * The homepage's catalogue section: one title, a category filter under it, and a grid.
 *
 * The filter is the nav's Collections list — New In, then the house categories and any an admin
 * has added — and it shows every entry even while one has nothing in it: the owner wants the
 * range to read as the house's, not as whatever happens to be in stock. An empty filter says so
 * in the grid's place. New In leads and is where the section opens, so it starts on the newest
 * pieces across everything. Single-choice toggle buttons (aria-pressed) rather than tabs: this
 * narrows one grid, it does not switch between panels.
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
  const [activeKey, setActiveKey] = useState(categories[0]?.key ?? null);
  const [visible, setVisible] = useState(PAGE);

  // A key that goes stale — a revalidation can drop an admin-added category out from under this
  // state — resolves to the first entry, New In, rather than to an empty grid.
  const active = categories.find((c) => c.key === activeKey) ?? categories[0] ?? null;
  // New In (value null) is every category's newest pieces: the pool as it arrives, newest first.
  const filtered =
    active?.value == null ? products : products.filter((p) => p.category === active.value);
  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  function select(key: string) {
    setActiveKey(key);
    // A filter you have never opened should start at the top of its list, not inherit
    // however far you scrolled the previous one.
    setVisible(PAGE);
  }

  return (
    <section className="px-4 pt-[70px] pb-[90px] md:px-8">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="section-title">{title}</h2>

        {categories.length > 0 && (
          <div
            role="group"
            aria-label={t("filterBy")}
            // Scrollable rather than wrapping: a wrapped row becomes ragged lines above the grid.
            // When the categories outgrow a phone (in English, five already do at 375pt), the
            // row scrolls, and it bleeds to the screen edges (-mx-4 px-4) so the last label is
            // cut by the glass rather than by the page margin, which reads as "more this way".
            // Wide gaps (24px, 48px from md) so each category reads as its own destination.
            className="no-scrollbar -mx-4 mt-6 flex justify-start gap-6 overflow-x-auto px-4 md:mx-0 md:justify-center md:gap-12 md:px-0"
          >
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                aria-pressed={active?.key === category.key}
                onClick={() => select(category.key)}
                className="tab-label focus-ring shrink-0 whitespace-nowrap"
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

        {filtered.length > 0 ? (
          <>
            <div className="mt-10">
              <ProductGridClient products={shown} eagerCount={EAGER_CARDS} />
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
          </>
        ) : (
          // In the grid's place, at roughly its height's worth of air, so switching to an empty
          // category does not collapse the page under the shopper's pointer.
          <p className="py-24 text-center text-sm text-muted">{tcol("comingSoon")}</p>
        )}
      </div>
    </section>
  );
}
