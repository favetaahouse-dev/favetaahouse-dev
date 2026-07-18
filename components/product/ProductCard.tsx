import { getTranslations } from "next-intl/server";
import { ProductCardView } from "./ProductCardView";
import type { ProductCardDTO } from "@/lib/data/catalog";

/**
 * A server component. The only interactive parts of a card are <Price> and
 * <WishlistButton>, which carry their own "use client", so resolving the two badge labels
 * here hydrates a couple of small leaves per card instead of a whole card tree — 20 of
 * those on the homepage, 99 on /collections/all.
 */
export async function ProductCard({ product }: { product: ProductCardDTO }) {
  const t = await getTranslations("product");
  return (
    <ProductCardView
      product={product}
      labels={{ outOfStock: t("outOfStock"), sale: t("sale") }}
    />
  );
}
