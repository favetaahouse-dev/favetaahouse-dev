import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProductByHandle, getRelatedProducts, getAllProductHandles } from "@/lib/data/catalog";
import { getVariantOptions, getMadeToOrderSettings } from "@/lib/content";
import { applicableFields, fieldLabel } from "@/lib/measurements";
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
  const { locale, handle } = await params;
  const p = await getProductByHandle(handle, locale);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description ?? "FAVETAA luxury modest fashion.",
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

  const product = await getProductByHandle(handle, locale);
  if (!product) notFound();

  // Both CMS reads ride the same "content" cache tag as getVariantOptions already did, so the
  // made-to-order schema adds nothing new to this page's cache graph.
  const [related, options, mtoSettings] = await Promise.all([
    getRelatedProducts(product.id, product.category, 4, locale),
    getVariantOptions(),
    getMadeToOrderSettings(),
  ]);

  /**
   * The made-to-order panel is assembled HERE, not in the client component: the field list is
   * bilingual in the CMS and the lead time may fall back to the house default, so resolving both
   * server-side means the browser receives one localised, complete object instead of the raw
   * blob plus the logic to interpret it.
   */
  const ar = locale === "ar";
  const mto: ProductDetailDTO["mto"] = product.offersMto
    ? {
        price: product.mtoPrice!,
        compareAt: product.mtoCompareAt,
        leadMin: product.mtoLeadMin ?? mtoSettings.leadMinDays,
        leadMax: product.mtoLeadMax ?? mtoSettings.leadMaxDays,
        unit: mtoSettings.defaultUnit,
        fields: applicableFields(mtoSettings.fields, product.mtoFields).map((f) => ({
          key: f.key,
          label: fieldLabel(f, locale),
          min: f.min,
          max: f.max,
          required: f.required,
        })),
        // `||` not `??` throughout: a field cleared in the admin is "", which must fall through
        // to the other language rather than render as an empty block.
        intro: (ar ? mtoSettings.introAr || mtoSettings.intro : mtoSettings.intro) || "",
        guide: (ar ? mtoSettings.guideAr || mtoSettings.guide : mtoSettings.guide) || "",
        guideImage: mtoSettings.guideImage,
        notesLabel: (ar ? mtoSettings.notesLabelAr || mtoSettings.notesLabel : mtoSettings.notesLabel) || "",
      }
    : null;

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
    colors: product.colors,
    variants: product.variants.map((v) => ({
      id: v.id,
      colorId: v.colorId,
      size: v.size,
      sku: v.sku,
      price: v.price,
      compareAt: v.compareAt,
      stock: v.stock,
      available: v.available,
      imageUrl: v.imageUrl,
    })),
    lengths: options.lengths,
    offersMto: product.offersMto,
    offersRtw: product.offersRtw,
    mto,
  };

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.title,
    image: product.images.map((i) => i.url),
    description: product.description ?? undefined,
    sku: product.variants[0]?.sku ?? product.productCode ?? undefined,
    brand: { "@type": "Brand", name: "FAVETAA" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "QAR",
      // price_min/price_max already fold the made-to-order price in — see
      // recompute_product_prices in 20260816120000_made_to_order.sql.
      lowPrice: (product.priceMin / 100).toFixed(2),
      highPrice: (product.priceMax / 100).toFixed(2),
      // A made-to-order piece is cut after the sale and is never out of stock. Without the
      // first clause the entire made-to-order catalogue would advertise OutOfStock to Google,
      // which is the same bug the product cards had.
      availability:
        product.offersMto || product.variants.some((v) => v.available)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        // Escape `<` so a product title containing `</script>` can't break out of the block.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductDetail product={dto} />
      <ProductRecommendations products={related} />
    </div>
  );
}
