import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  getCollectionProducts,
  getCollectionTitle,
  getCollectionFacets,
  getPriceRange,
  type SortKey,
} from "@/lib/data/collections";
import { CollectionToolbar } from "@/components/collection/CollectionToolbar";
import { ProductGrid } from "@/components/product/ProductGrid";

type Params = { locale: string; handle: string };
type Search = { [key: string]: string | string[] | undefined };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { handle } = await params;
  const title = await getCollectionTitle(handle);
  return { title };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { locale, handle } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const query = {
    sort: str(sp.sort) as SortKey | undefined,
    inStock: str(sp.inStock) === "1",
    minPrice: str(sp.min) ? Number(str(sp.min)) * 100 : undefined,
    maxPrice: str(sp.max) ? Number(str(sp.max)) * 100 : undefined,
    color: str(sp.color),
    material: str(sp.material),
  };

  const [{ products, total }, title, range, facets, t] = await Promise.all([
    getCollectionProducts(handle, query),
    getCollectionTitle(handle),
    getPriceRange(),
    getCollectionFacets(handle),
    getTranslations("collection"),
  ]);

  return (
    <div>
      <div className="px-4 py-10 text-center md:px-8 md:py-12">
        <h1 className="section-title">{title}</h1>
      </div>
      <CollectionToolbar total={total} priceMax={range.max} facets={facets} />
      <div className="px-4 py-10 md:px-8">
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <p className="py-24 text-center text-sm text-muted">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
