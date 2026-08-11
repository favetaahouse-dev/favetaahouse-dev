"use client";

import { useTranslations } from "next-intl";
import { ProductCardView, PRODUCT_GRID_CLASS } from "@/components/product/ProductCardView";
import type { ProductCardDTO } from "@/lib/data/catalog";

/**
 * The grid for client components — the tabbed homepage section and the wishlist, both of
 * which pick their products in the browser and so cannot render the server <ProductGrid>.
 *
 * It exists because <ProductCard> is an async server component: reaching it from a `"use
 * client"` module put it in the client graph, where `getTranslations` is unavailable and
 * React refuses to render an async component — the "`getTranslations` is not supported in
 * Client Components" failure. Resolving the two badge labels once here, from the client
 * translator, keeps a single copy of the card markup on both sides of the boundary.
 */
export function ProductGridClient({ products }: { products: ProductCardDTO[] }) {
  const t = useTranslations("product");
  const labels = { outOfStock: t("outOfStock"), sale: t("sale") };
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {products.map((p) => (
        <ProductCardView key={p.handle} product={p} labels={labels} />
      ))}
    </div>
  );
}
