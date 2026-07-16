import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProductByHandle, getRelatedProducts } from "@/lib/data/catalog";
import { ProductDetail, type ProductDetailDTO } from "@/components/product/ProductDetail";
import { ProductRecommendations } from "@/components/product/ProductRecommendations";

type Params = { locale: string; handle: string };

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

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { locale, handle } = await params;
  setRequestLocale(locale);

  const product = await getProductByHandle(handle);
  if (!product) notFound();

  const related = await getRelatedProducts(product.id, product.category, 4);

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
