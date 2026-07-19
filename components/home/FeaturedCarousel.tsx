import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n-navigation";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { ProductCardDTO } from "@/lib/data/catalog";

export async function FeaturedCarousel({ products }: { products: ProductCardDTO[] }) {
  if (products.length === 0) return null;
  const t = await getTranslations("home");

  return (
    <section className="bg-haze px-4 py-16 md:px-8">
      <h2 className="section-title mb-10">{t("exploreCreation")}</h2>
      <ProductGrid products={products} />
      <div className="mt-12 flex justify-center">
        <Link href="/collections/all" className="btn-brand">
          {t("displayAll")}
        </Link>
      </div>
    </section>
  );
}
