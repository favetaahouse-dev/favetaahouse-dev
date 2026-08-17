"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable, type Column, Button, StatusPill, Money, Badge } from "./ui";
import { bulkProductAction, type BulkAction } from "@/lib/actions/products";
import type { AdminProductRow } from "@/lib/data/admin-catalog";

export function ProductsTable({ rows }: { rows: AdminProductRow[] }) {
  const router = useRouter();

  const bulk = async (ids: string[], action: BulkAction, clear: () => void) => {
    try {
      await bulkProductAction(ids, action);
      toast.success(`${action} · ${ids.length} product(s)`);
      clear();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const columns: Column<AdminProductRow>[] = [
    { key: "title", header: "Title", sortable: true, sortValue: (r) => r.title, cell: (r) => <span className="text-foreground">{r.title}</span> },
    { key: "category", header: "Category", cell: (r) => <span className="text-secondary">{r.category}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusPill status={r.status} /> },
  {
    key: "fulfillment",
    header: "Made",
    cell: (r) => (
      <Badge tone={r.fulfillment === "READY_TO_WEAR" ? "neutral" : "info"}>
        {r.fulfillment === "MADE_TO_ORDER" ? "To order" : r.fulfillment === "BOTH" ? "Both" : "Ready"}
      </Badge>
    ),
  },
    { key: "price", header: "Price", align: "right", sortable: true, sortValue: (r) => r.priceMin, cell: (r) => <Money cents={r.priceMin} /> },
    { key: "variants", header: "Variants", align: "center", cell: (r) => r.variantCount },
    { key: "stock", header: "Stock", align: "center", sortable: true, sortValue: (r) => r.totalStock, cell: (r) =>
      // A made-to-order product holds no stock at all, so the low-stock red would paint the
      // whole new catalogue as a problem. An em-dash says "not applicable", not "zero".
      r.fulfillment === "MADE_TO_ORDER" ? (
        <span className="text-secondary">—</span>
      ) : (
        <span className={r.totalStock <= 2 ? "text-danger" : ""}>{r.totalStock}</span>
      ) },
    { key: "flags", header: "", cell: (r) => (r.featured ? <StatusPill status="featured" /> : r.onSale ? <StatusPill status="sale" /> : null) },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      rowHref={(r) => `/admin/products/${r.id}`}
      searchable
      searchText={(r) => `${r.title} ${r.category} ${r.tags.join(" ")} ${r.fulfillment === "MADE_TO_ORDER" ? "made to order" : r.fulfillment === "BOTH" ? "made to order ready to wear" : "ready to wear"}`}
      searchPlaceholder="Search products…"
      selectable
      bulkActions={(ids, clear) => (
        <>
          <Button size="sm" variant="outline" onClick={() => bulk(ids, "feature", clear)}>Feature</Button>
          <Button size="sm" variant="outline" onClick={() => bulk(ids, "activate", clear)}>Activate</Button>
          <Button size="sm" variant="outline" onClick={() => bulk(ids, "draft", clear)}>Draft</Button>
          <Button size="sm" variant="outline" onClick={() => bulk(ids, "archive", clear)}>Archive</Button>
          <Button size="sm" variant="danger" onClick={() => bulk(ids, "delete", clear)}>Delete</Button>
        </>
      )}
      pageSize={25}
    />
  );
}
