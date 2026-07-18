"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import { useWishlist } from "@/components/providers/wishlist-context";
import { getCardsByHandles } from "@/lib/actions/catalog";
import { PRODUCT_GRID_CLASS } from "@/components/product/ProductGrid";
import { ProductCardView } from "@/components/product/ProductCardView";
import type { ProductCardDTO } from "@/lib/data/catalog";

export function WishlistView() {
  const t = useTranslations("actions");
  const tc = useTranslations("cart");
  const tp = useTranslations("product");
  const { handles, ready } = useWishlist();
  const [products, setProducts] = useState<ProductCardDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (handles.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    getCardsByHandles(handles).then((p) => {
      setProducts(p);
      setLoading(false);
    });
  }, [handles, ready]);

  return (
    <div className="px-4 py-12 md:px-8">
      <h1 className="section-title mb-10">{t("wishlist")}</h1>
      {!loading && products.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-muted">{tc("empty")}</p>
          <Link href="/collections/all" className="btn-brand mt-6 inline-flex">
            {tc("continueShopping")}
          </Link>
        </div>
      ) : (
        // The wishlist lives in localStorage, so its cards are rendered client-side and
        // take their labels from the client translator rather than the server one.
        <div className={PRODUCT_GRID_CLASS}>
          {products.map((p) => (
            <ProductCardView
              key={p.handle}
              product={p}
              labels={{ outOfStock: tp("outOfStock"), sale: tp("sale") }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
