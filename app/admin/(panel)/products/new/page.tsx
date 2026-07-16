import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";

export default function NewProductPage() {
  return (
    <div>
      <PageHeader title="New product" description="Create the product, then add its variants and images." />
      <ProductForm />
    </div>
  );
}
