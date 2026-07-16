import { listInventory } from "@/lib/data/admin-catalog";
import { PageHeader } from "@/components/admin/ui";
import { InventoryTable } from "@/components/admin/InventoryTable";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const rows = await listInventory();
  const low = rows.filter((r) => r.stock <= 2).length;
  return (
    <div>
      <PageHeader
        title="Inventory"
        description={`${rows.length} variants · ${low} low or out of stock · adjust stock manually below`}
      />
      <InventoryTable rows={rows} />
    </div>
  );
}
