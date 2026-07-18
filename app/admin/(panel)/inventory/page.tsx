import { listInventory } from "@/lib/data/admin-catalog";
import { PageHeader } from "@/components/admin/ui";
import { InventoryTable } from "@/components/admin/InventoryTable";
import { requirePageAccess } from "@/lib/admin-guard";

export default async function InventoryPage() {
  await requirePageAccess("inventory:read");
  const { rows, total } = await listInventory();
  const low = rows.filter((r) => r.stock <= 2).length;
  const capped = total > rows.length;
  return (
    <div>
      <PageHeader
        title="Inventory"
        description={
          capped
            ? `Lowest-stock ${rows.length} of ${total} variants · ${low} low or out · open a product to manage all its stock at once`
            : `${total} variants · ${low} low or out of stock · adjust stock below`
        }
      />
      <InventoryTable rows={rows} />
    </div>
  );
}
