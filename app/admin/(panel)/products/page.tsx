import Link from "next/link";
import { Plus } from "lucide-react";
import { listAdminProducts } from "@/lib/data/admin-catalog";
import { PageHeader, Button } from "@/components/admin/ui";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { ImportButton } from "@/components/admin/ImportButton";
import { requirePageAccess } from "@/lib/admin-guard";

export default async function AdminProducts() {
  await requirePageAccess("products:read");
  const rows = await listAdminProducts();
  return (
    <div>
      <PageHeader
        title="Products"
        description={`${rows.length} products`}
        actions={
          <>
            <a href="/api/admin/export/products" className="inline-flex items-center px-3.5 py-2 text-[13px] text-secondary hover:text-foreground">
              Export CSV
            </a>
            <ImportButton />
            <Link href="/admin/products/new"><Button variant="primary"><Plus size={14} /> New product</Button></Link>
          </>
        }
      />
      <ProductsTable rows={rows} />
    </div>
  );
}
