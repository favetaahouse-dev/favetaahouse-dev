import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { requirePageAccess } from "@/lib/admin-guard";

export default async function NewProductPage() {
  await requirePageAccess("products:write");
  return (
    <div>
      <PageHeader title="New product" description="Create the product, then add its variants and images." />
      <ProductForm />
    </div>
  );
}
