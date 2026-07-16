"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import { Button, Panel, SectionLabel } from "./ui";
import { createProduct, updateProduct, type ProductInput } from "@/lib/actions/products";
import type { AdminProduct } from "@/lib/data/admin-catalog";
import { cn } from "@/lib/utils";

const CATEGORIES = ["ABAYA", "JALABIYA", "SHEILA", "OTHER"];
const STATUSES = ["active", "draft", "archived"];
const input =
  "w-full border border-edge bg-canvas px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-faint focus:border-accent/60";

export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const isCreate = !product;
  const [saving, setSaving] = useState(false);

  // create-only: variant matrix + images
  const [colors, setColors] = useState<{ name: string; hex: string }[]>([{ name: "Black", hex: "#111111" }]);
  const [sizes, setSizes] = useState<string[]>(["One Size"]);
  const [cover, setCover] = useState<File | null>(null);
  const [gallery, setGallery] = useState<File[]>([]);

  const [f, setF] = useState({
    title: product?.title ?? "", titleAr: product?.titleAr ?? "",
    description: product?.description ?? "", descriptionAr: product?.descriptionAr ?? "",
    productCode: product?.productCode ?? "", materials: product?.materials ?? "",
    materialsAr: product?.materialsAr ?? "", modelSize: product?.modelSize ?? "",
    details: product?.details ?? "", detailsAr: product?.detailsAr ?? "", packaging: product?.packaging ?? "",
    category: product?.category ?? "ABAYA", status: product?.status ?? "active",
    featured: product?.featured ?? false, onSale: product?.onSale ?? false,
    tagsStr: (product?.tags ?? []).join(", "),
    price: "", stock: "",
  });
  const set = (k: keyof typeof f, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const updateColor = (i: number, key: "name" | "hex", v: string) =>
    setColors((cs) => cs.map((c, idx) => (idx === i ? { ...c, [key]: v } : c)));
  const addColor = () => setColors((cs) => [...cs, { name: "", hex: "#c69229" }]);
  const removeColor = (i: number) => setColors((cs) => cs.filter((_, idx) => idx !== i));
  const addSize = (raw: string) => {
    const v = raw.trim();
    if (v && !sizes.includes(v)) setSizes([...sizes, v]);
  };

  const colorCount = colors.filter((c) => c.name.trim()).length || 1;
  const variantCount = colorCount * (sizes.length || 1);

  const submit = async () => {
    if (!f.title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      const payload: ProductInput = {
        title: f.title, titleAr: f.titleAr, description: f.description, descriptionAr: f.descriptionAr,
        productCode: f.productCode, materials: f.materials, materialsAr: f.materialsAr, modelSize: f.modelSize,
        details: f.details, detailsAr: f.detailsAr, packaging: f.packaging,
        category: f.category, status: f.status, featured: f.featured, onSale: f.onSale,
        tags: f.tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
      };

      if (product) {
        await updateProduct(product.id, payload);
        toast.success("Saved");
        router.refresh();
        return;
      }

      // Build the color × size variant matrix.
      const cols = colors.filter((c) => c.name.trim()).length
        ? colors.filter((c) => c.name.trim())
        : [{ name: "Default", hex: "" }];
      const szs = sizes.length ? sizes : ["One Size"];
      const price = Math.round(Number(f.price) || 0);
      const stock = Math.round(Number(f.stock) || 0);
      const seeds = cols.flatMap((c) =>
        szs.map((s) => ({ color: c.name || "Default", colorHex: c.hex || null, size: s, price, stock })),
      );

      const res = await createProduct(payload, seeds);

      // Upload the cover FIRST (position 0), then gallery images (position 1+).
      const upload = async (file: File) => {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/admin/products/${res.id}/images`, { method: "POST", body: fd }).catch(() => {});
      };
      if (cover) await upload(cover);
      for (const file of gallery) await upload(file);

      toast.success(`Product created & published (${seeds.length} variant${seeds.length > 1 ? "s" : ""})`);
      router.push(`/admin/products/${res.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel className="space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><SectionLabel>Title (EN)</SectionLabel><input className={input} value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
          <label className="block"><SectionLabel>Title (AR)</SectionLabel><input dir="rtl" className={cn(input, "text-right")} value={f.titleAr} onChange={(e) => set("titleAr", e.target.value)} /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><SectionLabel>Description (EN)</SectionLabel><textarea rows={3} className={cn(input, "resize-y")} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="block"><SectionLabel>Description (AR)</SectionLabel><textarea dir="rtl" rows={3} className={cn(input, "resize-y text-right")} value={f.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block"><SectionLabel>Category</SectionLabel><select className={input} value={f.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="block"><SectionLabel>Status</SectionLabel><select className={input} value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="block"><SectionLabel>Product code</SectionLabel><input className={input} value={f.productCode} onChange={(e) => set("productCode", e.target.value)} /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><SectionLabel>Materials (EN)</SectionLabel><input className={input} value={f.materials} onChange={(e) => set("materials", e.target.value)} /></label>
          <label className="block"><SectionLabel>Materials (AR)</SectionLabel><input dir="rtl" className={cn(input, "text-right")} value={f.materialsAr} onChange={(e) => set("materialsAr", e.target.value)} /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><SectionLabel>Model size</SectionLabel><input className={input} value={f.modelSize} onChange={(e) => set("modelSize", e.target.value)} /></label>
          <label className="block"><SectionLabel>Tags (comma-separated)</SectionLabel><input className={input} value={f.tagsStr} onChange={(e) => set("tagsStr", e.target.value)} placeholder="new, summer, linen" /></label>
        </div>
        <div className="flex gap-6 pt-1">
          <label className="flex items-center gap-2 text-[13px] text-foreground"><input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured <span className="text-faint">(shows on homepage)</span></label>
          <label className="flex items-center gap-2 text-[13px] text-foreground"><input type="checkbox" checked={f.onSale} onChange={(e) => set("onSale", e.target.checked)} /> On sale</label>
        </div>
      </Panel>

      {isCreate && (
        <Panel className="space-y-6 p-5">
          <div>
            <SectionLabel className="mb-2">Colors (pick with the color wheel)</SectionLabel>
            <div className="space-y-2">
              {colors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="color" value={c.hex} onChange={(e) => updateColor(i, "hex", e.target.value)} className="h-8 w-11 cursor-pointer border border-edge bg-canvas p-0.5" aria-label="Pick color" />
                  <input value={c.name} onChange={(e) => updateColor(i, "name", e.target.value)} placeholder="Color name (e.g. Black, Olive)" className={cn(input, "flex-1")} />
                  <button type="button" onClick={() => removeColor(i)} className="text-faint hover:text-danger" aria-label="Remove color"><X size={15} /></button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="mt-2" onClick={addColor}><Plus size={13} /> Add color</Button>
          </div>

          <div>
            <SectionLabel className="mb-2">Sizes</SectionLabel>
            <div className="flex flex-wrap items-center gap-1.5 border border-edge bg-canvas p-2">
              {sizes.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 bg-elevated px-2 py-0.5 text-xs text-foreground">
                  {s}
                  <button type="button" onClick={() => setSizes(sizes.filter((x) => x !== s))} className="text-faint hover:text-danger" aria-label="Remove size"><X size={11} /></button>
                </span>
              ))}
              <input
                placeholder="Add size + Enter (e.g. S, M, L)"
                className="flex-1 bg-transparent px-1 py-0.5 text-[13px] text-foreground outline-none placeholder:text-faint"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addSize((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><SectionLabel>Price (fils)</SectionLabel><input type="number" min={0} className={input} value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="e.g. 45000" /></label>
            <label className="block"><SectionLabel>Quantity per variant</SectionLabel><input type="number" min={0} className={input} value={f.stock} onChange={(e) => set("stock", e.target.value)} placeholder="e.g. 10" /></label>
          </div>
          <p className="text-[11px] text-faint">One price &amp; quantity applies to every color × size — <b className="text-secondary">{variantCount}</b> variant(s) will be created. Prices are in fils (45000 = QAR 450). Refine individual variants after creating.</p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <SectionLabel>Cover image (main photo)</SectionLabel>
              <input type="file" accept="image/*" className="block w-full text-[13px] text-secondary file:mr-3 file:border file:border-edge file:bg-elevated file:px-3 file:py-1.5 file:text-foreground" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
              {cover && <span className="mt-1 block text-[11px] text-faint">{cover.name}</span>}
            </label>
            <label className="block">
              <SectionLabel>Gallery images</SectionLabel>
              <input type="file" accept="image/*" multiple className="block w-full text-[13px] text-secondary file:mr-3 file:border file:border-edge file:bg-elevated file:px-3 file:py-1.5 file:text-foreground" onChange={(e) => setGallery([...(e.target.files ?? [])])} />
              {gallery.length > 0 && <span className="mt-1 block text-[11px] text-faint">{gallery.length} image(s)</span>}
            </label>
          </div>
        </Panel>
      )}

      <div className="flex justify-end">
        <Button variant="primary" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : product ? "Save changes" : "Create product"}
        </Button>
      </div>
    </div>
  );
}
