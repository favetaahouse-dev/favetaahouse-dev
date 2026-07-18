import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  getCollectionProducts,
  getCollectionTitle,
  getCollectionFacets,
  getPriceRange,
  COLLECTION_HANDLES,
  type SortKey,
} from "@/lib/data/collections";
import { CollectionToolbar } from "@/components/collection/CollectionToolbar";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductGridSkeleton } from "@/components/product/ProductGridSkeleton";

type Params = { locale: string; handle: string };
type Search = { [key: string]: string | string[] | undefined };

export function generateStaticParams() {
  return COLLECTION_HANDLES.map((handle) => ({ handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  // getCollectionTitle carries its own "use cache", so this needs no cache scope of its
  // own — and awaiting `params` inside one would stall the prerender.
  const { handle } = await params;
  const title = await getCollectionTitle(handle);
  return { title };
}

/**
 * The heading prerenders into the static shell; the toolbar and grid depend on the filter
 * searchParams, so they stream in. An unfiltered visit — which is most of them — still
 * gets its HTML from the CDN rather than waiting on Singapore.
 */
export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { locale, handle } = await params;
  setRequestLocale(locale);
  const title = await getCollectionTitle(handle);

  return (
    <div>
      <div className="px-4 py-10 text-center md:px-8 md:py-12">
        <h1 className="section-title">{title}</h1>
      </div>
      <Suspense fallback={<CollectionSkeleton />}>
        <CollectionResults handle={handle} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CollectionResults({
  handle,
  searchParams,
}: {
  handle: string;
  searchParams: Promise<Search>;
}) {
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

  const [{ products, total }, range, facets, t] = await Promise.all([
    getCollectionProducts(handle, query),
    getPriceRange(),
    getCollectionFacets(handle),
    getTranslations("collection"),
  ]);

  return (
    <>
      <CollectionToolbar total={total} priceMax={range.max} facets={facets} />
      <div className="px-4 py-10 md:px-8">
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <p className="py-24 text-center text-sm text-muted">{t("empty")}</p>
        )}
      </div>
    </>
  );
}

function CollectionSkeleton() {
  return (
    <>
      <div className="h-[57px] border-y border-line" />
      <div className="px-4 py-10 md:px-8">
        <ProductGridSkeleton />
      </div>
    </>
  );
}
