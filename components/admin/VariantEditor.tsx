"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { Button, Panel, SectionLabel } from "./ui";
import { upsertVariant, deleteVariant } from "@/lib/actions/products";
import type { AdminVariant } from "@/lib/data/admin-catalog";
import { cn } from "@/lib/utils";

const input = "w-full border border-edge bg-canvas px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-accent/60";

export function VariantEditor({ productId, variants }: { productId: string; variants: AdminVariant[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(variants);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ color: "", hex: "#111111", size: "", sku: "", price: "", stock: "" });

  const edit = (id: string, k: keyof AdminVariant, v: unknown) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [k]: v } : x)));

  const save = async (v: AdminVariant) => {
    setBusy(true);
    try {
      await upsertVariant(productId, {
        id: v.id, color: v.color, colorHex: v.colorHex, size: v.size, sku: v.sku,
        price: Number(v.price) || 0, compareAt: v.compareAt, stock: Number(v.stock) || 0, position: v.position,
      });
      toast.success("Variant saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteVariant(productId, id);
      setRows((r) => r.filter((x) => x.id !== id));
      toast.success("Variant deleted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!draft.color.trim() || !draft.size.trim()) return toast.error("Color and size are required");
    setBusy(true);
    try {
      await upsertVariant(productId, {
        color: draft.color, colorHex: draft.hex, size: draft.size, sku: draft.sku || null,
        price: Math.round(Number(draft.price) || 0), stock: Math.round(Number(draft.stock) || 0), position: rows.length,
      });
      toast.success("Variant added");
      setDraft({ color: "", hex: "#111111", size: "", sku: "", price: "", stock: "" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="p-5">
      <SectionLabel className="mb-3">Variants ({rows.length})</SectionLabel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-faint">
              <th className="p-1 text-start">Color</th>
              <th className="p-1 text-start">Size</th>
              <th className="p-1 text-start">SKU</th>
              <th className="p-1 text-end">Price (fils)</th>
              <th className="p-1 text-end">Stock</th>
              <th className="p-1"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-t border-edge/60">
                <td className="p-1">
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={v.colorHex ?? "#000000"} onChange={(e) => edit(v.id, "colorHex", e.target.value)} className="h-8 w-9 shrink-0 cursor-pointer border border-edge p-0.5" aria-label="Color swatch" />
                    <input className={input} value={v.color} onChange={(e) => edit(v.id, "color", e.target.value)} />
                  </div>
                </td>
                <td className="p-1"><input className={input} value={v.size} onChange={(e) => edit(v.id, "size", e.target.value)} /></td>
                <td className="p-1"><input className={input} value={v.sku ?? ""} onChange={(e) => edit(v.id, "sku", e.target.value)} /></td>
                <td className="p-1"><input type="number" className={cn(input, "text-end")} value={v.price} onChange={(e) => edit(v.id, "price", Number(e.target.value))} /></td>
                <td className="p-1"><input type="number" className={cn(input, "text-end")} value={v.stock} onChange={(e) => edit(v.id, "stock", Number(e.target.value))} /></td>
                <td className="whitespace-nowrap p-1 text-end">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => save(v)}>Save</Button>
                  <button className="ms-1 text-faint hover:text-danger" disabled={busy} onClick={() => remove(v.id)} aria-label="Delete variant"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-edge">
              <td className="p-1">
                <div className="flex items-center gap-1.5">
                  <input type="color" value={draft.hex} onChange={(e) => setDraft((d) => ({ ...d, hex: e.target.value }))} className="h-8 w-9 shrink-0 cursor-pointer border border-edge p-0.5" aria-label="Color swatch" />
                  <input placeholder="Color" className={input} value={draft.color} onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))} />
                </div>
              </td>
              <td className="p-1"><input placeholder="Size" className={input} value={draft.size} onChange={(e) => setDraft((d) => ({ ...d, size: e.target.value }))} /></td>
              <td className="p-1"><input placeholder="SKU" className={input} value={draft.sku} onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))} /></td>
              <td className="p-1"><input type="number" placeholder="0" className={cn(input, "text-end")} value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} /></td>
              <td className="p-1"><input type="number" placeholder="0" className={cn(input, "text-end")} value={draft.stock} onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))} /></td>
              <td className="p-1 text-end"><Button size="sm" variant="primary" disabled={busy} onClick={add}><Plus size={13} /> Add</Button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-faint">Prices are in fils (QAR minor units). Saving a variant recomputes the product price range.</p>
    </Panel>
  );
}
