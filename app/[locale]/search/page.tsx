import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { searchProducts } from "@/lib/data/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const products = q ? await searchProducts(q, 48) : [];
  const t = await getTranslations("common");
  const ta = await getTranslations("actions");
  const tc = await getTranslations("collection");

  return (
    <div className="px-4 py-12 md:px-8">
      <h1 className="section-title mb-2">{ta("search")}</h1>
      {q && (
        <p className="mb-8 text-center text-sm text-muted">
          “{q}” — {tc("results", { count: products.length })}
        </p>
      )}
      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <p className="py-24 text-center text-sm text-muted">{t("noResults")}</p>
      )}
    </div>
  );
}
