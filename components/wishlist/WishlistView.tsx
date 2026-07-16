"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import { useWishlist } from "@/components/providers/wishlist-context";
import { getCardsByHandles } from "@/lib/actions/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { ProductCardDTO } from "@/lib/data/catalog";

export function WishlistView() {
  const t = useTranslations("actions");
  const tc = useTranslations("cart");
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
        <ProductGrid products={products} />
      )}
    </div>
  );
}
