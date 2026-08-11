import { getTranslations } from "next-intl/server";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { ProductCardDTO } from "@/lib/data/catalog";

export async function ProductRecommendations({ products }: { products: ProductCardDTO[] }) {
  if (!products.length) return null;
  const t = await getTranslations("product");
  return (
    <section className="bg-mist px-4 pt-[70px] pb-[90px] md:px-8">
      <h2 className="section-title mb-10">{t("youMayAlsoLike")}</h2>
      {/* <ProductGrid> rather than its own copy of the columns — this grid had drifted to
          four across while the catalogue moved to three. */}
      <div className="mx-auto max-w-[1200px]">
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
