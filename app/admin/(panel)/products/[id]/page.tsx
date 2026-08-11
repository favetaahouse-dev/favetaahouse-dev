import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminProduct } from "@/lib/data/admin-catalog";
import { PageHeader, Button, StatusPill } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { VariantGrid } from "@/components/admin/VariantGrid";
import { ProductActions } from "@/components/admin/ProductActions";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { requirePageAccess } from "@/lib/admin-guard";
import { getVariantOptions, getProductCategories } from "@/lib/content";

export default async function AdminProductEdit({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("products:read");
  const { id } = await params;
  const [product, options, categories] = await Promise.all([
    getAdminProduct(id),
    getVariantOptions(),
    getProductCategories(),
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      {/* Status was only discoverable as a dropdown halfway down the form, which is a strange
          place for the single fact that decides whether the product is on sale at all. It is a
          read of the same `f.status` the form edits, so the two cannot disagree after a save. */}
      <PageHeader
        title={product.title}
        badge={<StatusPill status={product.status} />}
        description={[
          product.category,
          product.handle,
          `${product.variants.length} variant${product.variants.length === 1 ? "" : "s"}`,
          `${product.totalQty} in stock`,
        ].join(" · ")}
        actions={
          <>
            <Link href={`/products/${product.handle}`} target="_blank">
              <Button variant="outline" title="Opens the public page in a new tab — a draft or archived product may not be visible there">
                View on site
              </Button>
            </Link>
            <ProductActions id={product.id} title={product.title} />
          </>
        }
      />
      <ProductForm product={product} options={options} categories={categories} />
      <VariantGrid productId={product.id} variants={product.variants} totalQty={product.totalQty} />
      <ImageUploader
        productId={product.id}
        initial={product.images.map((i) => ({ id: i.id, url: i.url, position: i.position }))}
      />
    </div>
  );
}
