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
export function ProductGrid({
  products,
  eagerCount = 0,
}: {
  products: ProductCardDTO[];
  /** Leading cards to load eagerly — EAGER_CARDS when the grid opens the page. */
  eagerCount?: number;
}) {
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {products.map((p, i) => (
        <ProductCard key={p.handle} product={p} eager={i < eagerCount} />
      ))}
    </div>
  );
}
