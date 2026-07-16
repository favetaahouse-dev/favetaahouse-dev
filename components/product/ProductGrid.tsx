import { ProductCard } from "@/components/product/ProductCard";
import type { ProductCardDTO } from "@/lib/data/catalog";

export function ProductGrid({ products }: { products: ProductCardDTO[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-4 md:gap-x-6 md:gap-y-14">
      {products.map((p) => (
        <ProductCard key={p.handle} product={p} />
      ))}
    </div>
  );
}
