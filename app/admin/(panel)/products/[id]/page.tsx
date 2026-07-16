import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminProduct } from "@/lib/data/admin-catalog";
import { PageHeader, Button } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { ProductActions } from "@/components/admin/ProductActions";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { requirePageAccess } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function AdminProductEdit({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("products:read");
  const { id } = await params;
  const product = await getAdminProduct(id);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.title}
        description={`${product.category} · ${product.handle}`}
        actions={
          <>
            <Link href={`/products/${product.handle}`} target="_blank"><Button variant="outline">View on site</Button></Link>
            <ProductActions id={product.id} title={product.title} />
          </>
        }
      />
      <ProductForm product={product} />
      <VariantEditor productId={product.id} variants={product.variants} />
      <ImageUploader
        productId={product.id}
        initial={product.images.map((i) => ({ id: i.id, url: i.url, position: i.position }))}
      />
    </div>
  );
}
