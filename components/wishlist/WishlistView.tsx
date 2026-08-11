"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import { useWishlist } from "@/components/providers/wishlist-context";
import { getCardsByHandles } from "@/lib/actions/catalog";
import { ProductGridClient } from "@/components/product/ProductGridClient";
import type { ProductCardDTO } from "@/lib/data/catalog";

export function WishlistView() {
  const t = useTranslations("actions");
  const tc = useTranslations("cart");
  const locale = useLocale();
  const { handles, ready } = useWishlist();
  // Cards are stored under the wishlist they were fetched for, so "loading" and "what to
  // show" are both comparisons against the current list rather than state to keep in step.
  const [loaded, setLoaded] = useState<{ key: string; items: ProductCardDTO[] } | null>(null);

  const key = `${locale}:${handles.join(",")}`;
  const settled = loaded?.key === key;
  // An empty wishlist has nothing to fetch, so it is never in a loading state.
  const loading = !ready || (handles.length > 0 && !settled);
  const shown = loaded && settled ? loaded.items : [];

  useEffect(() => {
    if (!ready || handles.length === 0) return;
    // Removing the last item while a fetch for the previous, longer list is still in flight
    // used to let that response land and repopulate the grid.
    let cancelled = false;
    getCardsByHandles(handles, locale).then((items) => {
      if (!cancelled) setLoaded({ key, items });
    });
    return () => {
      cancelled = true;
    };
  }, [key, handles, ready, locale]);

  return (
    <div className="px-4 py-12 md:px-8">
      <h1 className="section-title mb-10">{t("wishlist")}</h1>
      {!loading && shown.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-muted">{tc("empty")}</p>
          <Link href="/collections/all" className="btn-brand mt-6 inline-flex">
            {tc("continueShopping")}
          </Link>
        </div>
      ) : (
        // The wishlist lives in localStorage, so its cards are picked in the browser and
        // rendered through the client grid rather than the server one.
        <ProductGridClient products={shown} />
      )}
    </div>
  );
}
