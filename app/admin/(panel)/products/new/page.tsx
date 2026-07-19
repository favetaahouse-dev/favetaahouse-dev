import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { requirePageAccess } from "@/lib/admin-guard";
import { getVariantOptions, getProductCategories } from "@/lib/content";

export default async function NewProductPage() {
  await requirePageAccess("products:write");
  const [options, categories] = await Promise.all([getVariantOptions(), getProductCategories()]);
  return (
    <div>
      <PageHeader title="New product" description="Fill in the details, pick sizes/lengths/colours, then create." />
      <ProductForm options={options} categories={categories} />
    </div>
  );
}
