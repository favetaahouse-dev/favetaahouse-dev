import { ProductCard } from "@/components/product/ProductCard";
import { PRODUCT_GRID_CLASS } from "@/components/product/ProductCardView";
import type { ProductCardDTO } from "@/lib/data/catalog";

/**
 * The server-rendered grid: each card resolves its own labels through getTranslations, so
 * only the two interactive leaves inside a card hydrate.
 *
 * Client components must use <ProductGridClient> instead — importing anything from this
 * module pulls the async <ProductCard> into the client graph, where it cannot run.
 */
export function ProductGrid({ products }: { products: ProductCardDTO[] }) {
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {products.map((p) => (
        <ProductCard key={p.handle} product={p} />
      ))}
    </div>
  );
}
