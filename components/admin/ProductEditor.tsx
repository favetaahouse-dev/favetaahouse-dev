"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateVariantStock, updateProductFlags } from "@/lib/actions/admin";
import { formatMoney } from "@/lib/money";

type Variant = { id: string; color: string; size: string; sku: string | null; price: number; stock: number };

export function ProductEditor({
  product,
}: {
  product: { id: string; title: string; featured: boolean; onSale: boolean; variants: Variant[] };
}) {
  const [featured, setFeatured] = useState(product.featured);
  const [onSale, setOnSale] = useState(product.onSale);
  const [stocks, setStocks] = useState<Record<string, number>>(
    Object.fromEntries(product.variants.map((v) => [v.id, v.stock])),
  );

  async function saveFlags(next: { featured?: boolean; onSale?: boolean }) {
    await updateProductFlags(product.id, next);
    toast.success("Saved");
  }
  async function saveStock(id: string) {
    await updateVariantStock(id, stocks[id]);
    toast.success("Stock updated");
  }

  return (
    <div className="border border-white/10 bg-[#222320] p-5">
      <div className="mb-6 flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => { setFeatured(e.target.checked); saveFlags({ featured: e.target.checked }); }}
            className="h-4 w-4 accent-gold"
          />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onSale}
            onChange={(e) => { setOnSale(e.target.checked); saveFlags({ onSale: e.target.checked }); }}
            className="h-4 w-4 accent-gold"
          />
          On sale
        </label>
      </div>

      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
            <th className="py-3 text-start">Color</th>
            <th className="py-3 text-start">Size</th>
            <th className="py-3 text-start">SKU</th>
            <th className="py-3 text-start">Price</th>
            <th className="py-3 text-start">Stock</th>
            <th className="py-3"></th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((v) => (
            <tr key={v.id} className="border-b border-white/5">
              <td className="py-2">{v.color}</td>
              <td className="py-2">{v.size}</td>
              <td className="py-2 text-xs text-white/40">{v.sku}</td>
              <td className="py-2">{formatMoney(v.price, "QAR")}</td>
              <td className="py-2">
                <input
                  type="number"
                  min={0}
                  value={stocks[v.id]}
                  onChange={(e) => setStocks({ ...stocks, [v.id]: Number(e.target.value) })}
                  className="w-20 border border-white/15 bg-transparent px-2 py-1 outline-none focus:border-gold"
                />
              </td>
              <td className="py-2">
                <button
                  onClick={() => saveStock(v.id)}
                  className="bg-gold px-3 py-1 text-xs font-medium text-[#1b1a18] hover:opacity-90"
                >
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
