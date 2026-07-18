import { ProductCard } from "@/components/product/ProductCard";
import type { ProductCardDTO } from "@/lib/data/catalog";

/** Shared so the client-rendered wishlist grid lines up with the catalogue ones. */
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-4 md:gap-x-6 md:gap-y-14";

export function ProductGrid({ products }: { products: ProductCardDTO[] }) {
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {products.map((p) => (
        <ProductCard key={p.handle} product={p} />
      ))}
    </div>
  );
}
