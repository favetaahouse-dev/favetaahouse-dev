import { getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/product/ProductCard";
import type { ProductCardDTO } from "@/lib/data/catalog";

export async function ProductRecommendations({ products }: { products: ProductCardDTO[] }) {
  if (!products.length) return null;
  const t = await getTranslations("product");
  return (
    <section className="bg-mist px-4 py-16 md:px-8">
      <h2 className="section-title mb-10">{t("youMayAlsoLike")}</h2>
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
        {products.map((p) => (
          <ProductCard key={p.handle} product={p} />
        ))}
      </div>
    </section>
  );
}
