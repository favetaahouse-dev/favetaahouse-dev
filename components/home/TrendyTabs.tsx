"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import { ProductGridClient } from "@/components/product/ProductGridClient";
import type { ProductCardDTO } from "@/lib/data/catalog";

export type TrendyTab = {
  /** Collection handle, so the tab's own label can also be a way into the full listing. */
  handle: string;
  label: string;
  href: string;
  products: ProductCardDTO[];
};

/** How many cards a tab shows before "load more", and how many each press adds. */
const PAGE = 6;

/**
 * The homepage's catalogue section: one title, a row of category tabs, and a grid.
 *
 * Every tab's products arrive in the initial payload (one grouped query — see
 * getProductsByCategory), so switching is instant and offline-safe: no fetch, no spinner,
 * no skeleton that shifts the page. The trade is a larger first payload, which is the right
 * side of that trade for six cards a tab.
 *
 * "Load more" reveals from what is already here rather than paging the server, so it can
 * never fail. Once a tab is exhausted the button is replaced by a link into the full
 * collection, which is the honest next step.
 */
export function TrendyTabs({ tabs, title }: { tabs: TrendyTab[]; title: string }) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const [activeHandle, setActiveHandle] = useState(tabs[0]?.handle ?? "");
  const [visible, setVisible] = useState(PAGE);

  if (tabs.length === 0) return null;

  // Falls back to the first tab rather than rendering nothing if the active handle ever
  // goes stale — a revalidation can drop a category out from under this state.
  const active = tabs.find((tab) => tab.handle === activeHandle) ?? tabs[0];
  const shown = active.products.slice(0, visible);
  const hasMore = active.products.length > visible;

  function selectTab(handle: string) {
    setActiveHandle(handle);
    // A tab you have never opened should start at the top of its list, not inherit
    // however far you scrolled the previous one.
    setVisible(PAGE);
  }

  return (
    <section className="px-4 pt-[70px] pb-[90px] md:px-8">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="section-title">{title}</h2>

        {tabs.length > 1 && (
          <div
            role="tablist"
            aria-label={title}
            // Scrollable rather than wrapping: with six categories on a 390pt screen a
            // wrapped row becomes three ragged lines above the grid.
            className="no-scrollbar mt-6 flex justify-start gap-7 overflow-x-auto md:justify-center"
          >
            {tabs.map((tab) => (
              <button
                key={tab.handle}
                role="tab"
                aria-selected={tab.handle === active.handle}
                onClick={() => selectTab(tab.handle)}
                className="tab-label shrink-0 whitespace-nowrap"
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

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
              href={active.href}
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
