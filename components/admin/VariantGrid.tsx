"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button, Panel, SectionLabel } from "./ui";
import { setVariantStock, setVariantPrice, setProductTotal, deleteVariants } from "@/lib/actions/products";
import { sortSizes } from "@/lib/variant-options";
import type { AdminVariant } from "@/lib/data/admin-catalog";
import { cn } from "@/lib/utils";

const input = "w-24 border border-edge bg-canvas px-2 py-1 text-[13px] text-foreground outline-none focus:border-accent/60";

/**
 * Quantity per colour + size, with an advisory product total. Enter quantities; if their sum
 * exceeds the total, Save asks to raise the total to match. Length + tack-tack aren't here —
 * they're storefront choices, not stock.
 */
export function VariantGrid({
  productId,
  variants,
  totalQty,
}: {
  productId: string;
  variants: AdminVariant[];
  totalQty: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(String(totalQty));
  const [stock, setStock] = useState<Record<string, number>>(() => Object.fromEntries(variants.map((v) => [v.id, v.stock])));
  const [prices, setPrices] = useState<Record<string, number>>(() => Object.fromEntries(variants.map((v) => [v.id, v.price])));

  // group by colour, sizes in canonical order
  const groups = useMemo(() => {
    const byColor = new Map<string, { hex: string | null; rows: AdminVariant[] }>();
    for (const v of variants) {
      const g = byColor.get(v.color) ?? { hex: v.colorHex, rows: [] };
      g.rows.push(v);
      byColor.set(v.color, g);
    }
    for (const g of byColor.values()) g.rows.sort((a, b) => sortSizes([a.size, b.size])[0] === a.size ? -1 : 1);
    return byColor;
  }, [variants]);

  const sum = Object.values(stock).reduce((s, n) => s + (n || 0), 0);
  const totalNum = Math.max(0, Math.round(Number(total) || 0));

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

  const saveStock = async () => {
    const changed = variants.filter((v) => (stock[v.id] ?? 0) !== v.stock).map((v) => ({ id: v.id, stock: stock[v.id] ?? 0 }));
    if (!changed.length) return toast.info("No quantity changes");
    let nextTotal = totalNum;
    if (sum > totalNum) {
      if (!confirm(`The sizes add up to ${sum}, above the product total of ${totalNum}. Raise the total to ${sum}?`)) return;
      nextTotal = sum;
    }
    setBusy(true);
    try {
      await setVariantStock(productId, changed);
      if (nextTotal !== totalQty) await setProductTotal(productId, nextTotal);
      setTotal(String(nextTotal));
      toast.success(`Saved ${changed.length} quantities`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const savePrice = (v: AdminVariant) =>
    run(() => setVariantPrice(productId, [v.id], Math.max(0, Math.round(prices[v.id] || 0))), "Price updated");

  const deleteColor = (color: string, rows: AdminVariant[]) => {
    if (!confirm(`Delete all ${rows.length} "${color}" variants?`)) return;
    run(() => deleteVariants(productId, rows.map((v) => v.id)), "Colour deleted");
  };

  const stockChanged = variants.some((v) => (stock[v.id] ?? 0) !== v.stock);

  if (!variants.length) {
    return (
      <Panel className="p-5">
        <SectionLabel className="mb-1">Variants &amp; quantities</SectionLabel>
        <p className="text-[13px] text-faint">No variants yet — add colours and sizes in the panel above.</p>
      </Panel>
    );
  }

  return (
    <Panel className="space-y-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionLabel>Variants &amp; quantities</SectionLabel>
        <div className="flex items-end gap-3">
          <label className="block">
            <SectionLabel>Total quantity</SectionLabel>
            <input type="number" min={0} className={input} value={total} onChange={(e) => setTotal(e.target.value)} />
          </label>
          <p className={cn("pb-1.5 text-[12px]", sum > totalNum ? "text-danger" : "text-faint")}>
            sizes sum to <b className="text-secondary">{sum}</b> / {totalNum}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {[...groups.entries()].map(([color, { hex, rows }]) => (
          <div key={color} className="border border-edge">
            <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
              <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-edge" style={{ background: hex ?? "#000" }} />
              <span className="text-[13px] font-medium text-foreground">{color}</span>
              <button type="button" disabled={busy} onClick={() => deleteColor(color, rows)} className="ms-auto text-faint hover:text-danger" aria-label="Delete colour"><Trash2 size={14} /></button>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.1em] text-faint">
                  <th className="p-1.5 text-start">Size</th>
                  <th className="p-1.5 text-end">Quantity</th>
                  <th className="p-1.5 text-end">Price (fils)</th>
                  <th className="p-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="border-t border-edge/60">
                    <td className="p-1.5 text-foreground">{v.size}</td>
                    <td className="p-1.5 text-end">
                      <input type="number" min={0} className={cn(input, "w-20 text-end", (stock[v.id] ?? 0) > 0 && "border-accent/40")}
                        value={stock[v.id] ?? 0}
                        onChange={(e) => setStock((s) => ({ ...s, [v.id]: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} />
                    </td>
                    <td className="p-1.5 text-end">
                      <input type="number" min={0} className={cn(input, "w-24 text-end")}
                        value={prices[v.id] ?? 0}
                        onChange={(e) => setPrices((p) => ({ ...p, [v.id]: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} />
                    </td>
                    <td className="p-1.5 text-end">
                      <Button size="sm" variant="outline" disabled={busy || (prices[v.id] ?? 0) === v.price} onClick={() => savePrice(v)}>Price</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        <p className="text-[11px] text-faint">Prices are in fils (45000 = QAR 450). A size at 0 shows greyed-out on the site.</p>
        <Button variant="primary" disabled={busy || !stockChanged} onClick={saveStock}>Save quantities</Button>
      </div>
    </Panel>
  );
}
