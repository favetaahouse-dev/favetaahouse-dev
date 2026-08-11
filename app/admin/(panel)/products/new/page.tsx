import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { requirePageAccess } from "@/lib/admin-guard";
import { getVariantOptions, getProductCategories } from "@/lib/content";

export default async function NewProductPage() {
  await requirePageAccess("products:write");
  const [options, categories] = await Promise.all([getVariantOptions(), getProductCategories()]);
  return (
    <div>
      {/* "lengths" was wrong: length is a made-to-order choice on the storefront, not a stocked
          variant dimension — see the note in VariantMatrixPanel. */}
      <PageHeader title="New product" description="Fill in the details, pick colours and sizes, add photos, then create." />
      <ProductForm options={options} categories={categories} />
    </div>
  );
}
