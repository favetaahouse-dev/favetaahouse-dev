"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Trash2 } from "lucide-react";
import { Button, Panel, SectionLabel } from "./ui";
import { setVariantStock, setVariantPrice, deleteVariants } from "@/lib/actions/products";
import { sortSizes } from "@/lib/variant-options";
import type { AdminVariant } from "@/lib/data/admin-catalog";
import { cn } from "@/lib/utils";

const input = "w-full border border-edge bg-canvas px-2 py-1 text-[13px] text-foreground outline-none focus:border-accent/60";

/**
 * Three-level inventory editor for the colour × size × length × tack-tack matrix. A flat table
 * of 100+ rows is unusable, so: colour accordion → size rows (with "set stock for all lengths")
 * → an expandable length × tack-tack grid of stock inputs.
 */
export function VariantGrid({ productId, variants }: { productId: string; variants: AdminVariant[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // group: color -> size -> cells
  const groups = useMemo(() => {
    const byColor = new Map<string, { hex: string | null; sizes: Map<string, AdminVariant[]> }>();
    for (const v of variants) {
      const c = byColor.get(v.color) ?? { hex: v.colorHex, sizes: new Map() };
      const cells = c.sizes.get(v.size) ?? [];
      cells.push(v);
      c.sizes.set(v.size, cells);
      byColor.set(v.color, c);
    }
    return byColor;
  }, [variants]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!variants.length) {
    return (
      <Panel className="p-5">
        <SectionLabel className="mb-1">Variants</SectionLabel>
        <p className="text-[13px] text-faint">No variants yet — use the panel above to generate them.</p>
      </Panel>
    );
  }

  return (
    <Panel className="p-5">
      <SectionLabel className="mb-3">Variants &amp; stock ({variants.length})</SectionLabel>
      <div className="space-y-2">
        {[...groups.entries()].map(([color, { hex, sizes }]) => (
          <ColorBlock
            key={color}
            productId={productId}
            color={color}
            hex={hex}
            sizes={sizes}
            busy={busy}
            run={run}
          />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-faint">Prices are in fils (45000 = QAR 450). Setting stock writes an inventory-ledger entry.</p>
    </Panel>
  );
}

function ColorBlock({
  productId, color, hex, sizes, busy, run,
}: {
  productId: string; color: string; hex: string | null;
  sizes: Map<string, AdminVariant[]>; busy: boolean;
  run: (fn: () => Promise<unknown>, ok: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const allCells = [...sizes.values()].flat();
  const totalStock = allCells.reduce((s, v) => s + v.stock, 0);
  const inStock = allCells.filter((v) => v.stock > 0).length;

  return (
    <div className="border border-edge">
      {/* toggle and delete are SIBLINGS — a button may not be nested in a button */}
      <div className="flex w-full items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-2 text-start">
          <ChevronRight size={15} className={cn("shrink-0 transition-transform", open && "rotate-90")} />
          <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-edge" style={{ background: hex ?? "#000" }} />
          <span className="text-[13px] font-medium text-foreground">{color}</span>
          <span className="text-[11px] text-faint">{allCells.length} variants · {inStock} in stock · total {totalStock}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => { if (confirm(`Delete all ${allCells.length} "${color}" variants?`)) run(() => deleteVariants(productId, allCells.map((v) => v.id)), "Colour deleted"); }}
          className="shrink-0 text-faint hover:text-danger" aria-label="Delete colour"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {open && (
        <div className="space-y-1 border-t border-edge p-2">
          {sortSizes([...sizes.keys()]).map((size) => (
            <SizeRow key={size} productId={productId} size={size} cells={sizes.get(size)!} busy={busy} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

function SizeRow({
  productId, size, cells, busy, run,
}: {
  productId: string; size: string; cells: AdminVariant[]; busy: boolean;
  run: (fn: () => Promise<unknown>, ok: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [bulkStock, setBulkStock] = useState("");
  const [priceStr, setPriceStr] = useState(String(cells[0]?.price ?? 0));
  const [edits, setEdits] = useState<Record<string, number>>({});

  const total = cells.reduce((s, v) => s + v.stock, 0);
  const lengths = [...new Set(cells.map((c) => c.length))].sort((a, b) => a - b);

  const cellFor = (length: number, tack: boolean) => cells.find((c) => c.length === length && c.tackTack === tack);
  const stockOf = (v: AdminVariant) => (v.id in edits ? edits[v.id] : v.stock);

  const applyBulk = () => {
    const n = Math.max(0, Math.round(Number(bulkStock) || 0));
    run(() => setVariantStock(productId, cells.map((v) => ({ id: v.id, stock: n }))), `Set all ${cells.length} to ${n}`);
  };
  const saveEdits = () => {
    const rows = cells.filter((v) => v.id in edits).map((v) => ({ id: v.id, stock: edits[v.id] }));
    if (!rows.length) return;
    run(() => setVariantStock(productId, rows), `Saved ${rows.length} cells`);
    setEdits({});
  };
  const savePrice = () => run(() => setVariantPrice(productId, cells.map((v) => v.id), Math.max(0, Math.round(Number(priceStr) || 0))), "Price updated");

  return (
    <div className="border border-edge/60 bg-canvas/40">
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-start">
          <ChevronRight size={13} className={cn("transition-transform", open && "rotate-90")} />
          <span className="text-[13px] font-medium text-foreground">{size}</span>
        </button>
        <span className="text-[11px] text-faint">{cells.length} cells · total {total}</span>
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <input type="number" min={0} placeholder="price" className={cn(input, "w-24")} value={priceStr} onChange={(e) => setPriceStr(e.target.value)} />
          <Button size="sm" variant="outline" disabled={busy} onClick={savePrice}>Price</Button>
          <input type="number" min={0} placeholder="stock" className={cn(input, "w-20")} value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} />
          <Button size="sm" variant="outline" disabled={busy || bulkStock === ""} onClick={applyBulk}>Set all</Button>
        </div>
      </div>
      {open && (
        <div className="overflow-x-auto border-t border-edge/60 p-2">
          <table className="text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.1em] text-faint">
                <th className="p-1 text-start">Length</th>
                <th className="p-1 text-center">No Tack Tack</th>
                <th className="p-1 text-center">Tack Tack</th>
              </tr>
            </thead>
            <tbody>
              {lengths.map((len) => (
                <tr key={len}>
                  <td className="p-1 text-secondary">{len}</td>
                  {[false, true].map((tack) => {
                    const v = cellFor(len, tack);
                    return (
                      <td key={String(tack)} className="p-1">
                        {v ? (
                          <input type="number" min={0} className={cn(input, "w-20 text-center", stockOf(v) > 0 && "border-accent/40")} value={stockOf(v)} onChange={(e) => setEdits((x) => ({ ...x, [v.id]: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} />
                        ) : (
                          <span className="block w-20 text-center text-faint">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {Object.keys(edits).length > 0 && (
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="primary" disabled={busy} onClick={saveEdits}>Save {Object.keys(edits).length} changes</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
