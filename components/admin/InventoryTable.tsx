"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { DataTable, type Column, Badge, Button } from "./ui";
import { adjustStock } from "@/lib/actions/inventory";
import type { InventoryRow } from "@/lib/data/admin-catalog";
import { variantLabel } from "@/lib/variant-options";

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const [data, setData] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);

  const apply = async (variantId: string, opts: { delta?: number; set?: number }) => {
    setBusy(variantId);
    try {
      const res = await adjustStock({ variantId, ...opts });
      setData((d) => d.map((r) => (r.variantId === variantId ? { ...r, stock: res.stock, available: res.stock > 0 } : r)));
      toast.success(`Stock updated to ${res.stock}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update stock");
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<InventoryRow>[] = [
    {
      key: "product", header: "Product", sortable: true, sortValue: (r) => r.productTitle,
      cell: (r) => (
        <div>
          <div className="text-foreground">{r.productTitle}</div>
          <div className="text-xs text-faint">{variantLabel(r)}{r.sku ? ` · ${r.sku}` : ""}</div>
        </div>
      ),
    },
    {
      key: "stock", header: "Stock", align: "center", sortable: true, sortValue: (r) => r.stock,
      cell: (r) => <span className={r.stock <= 2 ? "font-medium text-danger" : "text-foreground"}>{r.stock}</span>,
    },
    {
      key: "status", header: "Status", align: "center",
      cell: (r) => (
        <Badge tone={r.stock <= 0 ? "danger" : r.stock <= 2 ? "warn" : "positive"}>
          {r.stock <= 0 ? "Out" : r.stock <= 2 ? "Low" : "In stock"}
        </Badge>
      ),
    },
    {
      key: "adjust", header: "Adjust", align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" aria-label="Decrease" disabled={busy === r.variantId} onClick={() => apply(r.variantId, { delta: -1 })}>
            <Minus size={13} />
          </Button>
          <input
            type="number"
            defaultValue={r.stock}
            key={r.stock}
            className="w-16 border border-edge bg-canvas px-2 py-1 text-center text-[13px] text-foreground outline-none focus:border-accent/60"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = Number((e.target as HTMLInputElement).value);
                if (!Number.isNaN(val)) apply(r.variantId, { set: val });
              }
            }}
          />
          <Button size="sm" variant="outline" aria-label="Increase" disabled={busy === r.variantId} onClick={() => apply(r.variantId, { delta: 1 })}>
            <Plus size={13} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data}
      getRowId={(r) => r.variantId}
      searchable
      searchText={(r) => `${r.productTitle} ${r.color} ${r.size} ${r.sku ?? ""}`}
      searchPlaceholder="Search inventory…"
      pageSize={25}
      emptyTitle="No variants"
    />
  );
}
