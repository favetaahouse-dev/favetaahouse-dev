import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProductByHandle, getRelatedProducts, getAllProductHandles } from "@/lib/data/catalog";
import { getVariantOptions } from "@/lib/content";
import { ProductDetail, type ProductDetailDTO } from "@/components/product/ProductDetail";
import { ProductRecommendations } from "@/components/product/ProductRecommendations";

type Params = { locale: string; handle: string };

/**
 * Prerenders every live product. Nothing on this page is per-visitor, so each one can be
 * served from the CDN; a handle added after the build still renders on first visit.
 */
export async function generateStaticParams() {
  const handles = await getAllProductHandles();
  return handles.map((handle) => ({ handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { handle } = await params;
  const p = await getProductByHandle(handle);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description ?? "ALESSIA ABAYA luxury modest fashion.",
    openGraph: { images: p.images[0]?.url ? [p.images[0].url] : [] },
  };
}

/**
 * generateStaticParams covers every live handle, so those pages prerender whole. A handle
 * added after the build has no prerendered params, which makes them runtime data — the body
 * streams behind this boundary so the shell can still be served from the CDN on first visit.
 */
export default function ProductPage({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: { params: Promise<Params> }) {
  const { locale, handle } = await params;
  setRequestLocale(locale);

  const product = await getProductByHandle(handle);
  if (!product) notFound();

  const [related, options] = await Promise.all([
    getRelatedProducts(product.id, product.category, 4),
    getVariantOptions(),
  ]);

  const dto: ProductDetailDTO = {
    handle: product.handle,
    title: product.title,
    category: product.category,
    productCode: product.productCode,
    description: product.description,
    materials: product.materials,
    modelSize: product.modelSize,
    details: product.details,
    packaging: product.packaging,
    images: product.images.map((i) => ({ url: i.url, alt: i.alt })),
    variants: product.variants.map((v) => ({
      id: v.id,
      color: v.color,
      colorHex: v.colorHex,
      size: v.size,
      sku: v.sku,
      price: v.price,
      compareAt: v.compareAt,
      stock: v.stock,
      available: v.available,
      imageUrl: v.imageUrl,
    })),
    lengths: options.lengths,
  };

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.title,
    image: product.images.map((i) => i.url),
    description: product.description ?? undefined,
    sku: product.variants[0]?.sku ?? undefined,
    brand: { "@type": "Brand", name: "ALESSIA ABAYA" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "QAR",
      lowPrice: (product.priceMin / 100).toFixed(2),
      highPrice: (product.priceMax / 100).toFixed(2),
      availability: product.variants.some((v) => v.available)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetail product={dto} />
      <ProductRecommendations products={related} />
    </div>
  );
}
