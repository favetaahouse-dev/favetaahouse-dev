import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { requirePageAccess } from "@/lib/admin-guard";
import { getVariantOptions } from "@/lib/content";

export default async function NewProductPage() {
  await requirePageAccess("products:write");
  const options = await getVariantOptions();
  return (
    <div>
      <PageHeader title="New product" description="Fill in the details, pick sizes/lengths/colours, then create." />
      <ProductForm options={options} />
    </div>
  );
}
