"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Panel, SectionLabel } from "./ui";
import { createProduct, updateProduct, type ProductInput } from "@/lib/actions/products";
import { VariantMatrixPanel, type MatrixSpec } from "./VariantMatrixPanel";
import type { AdminProduct } from "@/lib/data/admin-catalog";
import { normalizeCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";

const STATUSES = ["active", "draft", "archived"] as const;
const input =
  "w-full border border-edge bg-canvas px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-faint focus:border-accent/60";

export function ProductForm({
  product,
  options,
  categories,
}: {
  product?: AdminProduct;
  options: { sizes: string[]; lengths: number[] };
  categories: string[];
}) {
  const router = useRouter();
  const isCreate = !product;
  const [saving, setSaving] = useState(false);
  const [cover, setCover] = useState<File | null>(null);
  const [gallery, setGallery] = useState<File[]>([]);
  const [spec, setSpec] = useState<MatrixSpec | null>(null);

  const [f, setF] = useState({
    title: product?.title ?? "", titleAr: product?.titleAr ?? "",
    description: product?.description ?? "", descriptionAr: product?.descriptionAr ?? "",
    productCode: product?.productCode ?? "", materials: product?.materials ?? "",
    materialsAr: product?.materialsAr ?? "", modelSize: product?.modelSize ?? "",
    details: product?.details ?? "", detailsAr: product?.detailsAr ?? "", packaging: product?.packaging ?? "",
    category: product?.category ?? "ABAYA", status: product?.status ?? "active",
    featured: product?.featured ?? false, onSale: product?.onSale ?? false,
    tagsStr: (product?.tags ?? []).join(", "),
  });
  const set = (k: keyof typeof f, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const existingKeys = product
    ? new Set(product.variants.map((v) => `${v.color}|${v.size}`))
    : undefined;

  const payload = (): ProductInput => ({
    title: f.title, titleAr: f.titleAr, description: f.description, descriptionAr: f.descriptionAr,
    productCode: f.productCode, materials: f.materials, materialsAr: f.materialsAr, modelSize: f.modelSize,
    details: f.details, detailsAr: f.detailsAr, packaging: f.packaging,
    category: normalizeCategory(f.category) as ProductInput["category"], status: f.status as ProductInput["status"],
    featured: f.featured, onSale: f.onSale,
    tags: f.tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
  });

  const submit = async () => {
    if (!f.title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      if (product) {
        await updateProduct(product.id, payload());
        toast.success("Saved");
        router.refresh();
        return;
      }
      if (!spec?.sizes.length) return toast.error("Pick at least one size for the variants");
      const res = await createProduct(payload(), spec);

      // cover first (position 0), then gallery
      const upload = async (file: File) => {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/admin/products/${res.id}/images`, { method: "POST", body: fd }).catch(() => {});
      };
      if (cover) await upload(cover);
      for (const file of gallery) await upload(file);

      toast.success("Product created & published");
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
          <label className="block"><SectionLabel>Category</SectionLabel><input className={input} list="category-options" value={f.category} onChange={(e) => set("category", e.target.value)} onBlur={(e) => set("category", normalizeCategory(e.target.value))} placeholder="ABAYA — or type a new one" /><datalist id="category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
          <label className="block"><SectionLabel>Status</SectionLabel><select className={input} value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="block"><SectionLabel>Product code</SectionLabel><input className={input} value={f.productCode} onChange={(e) => set("productCode", e.target.value)} /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><SectionLabel>Materials (EN)</SectionLabel><input className={input} value={f.materials} onChange={(e) => set("materials", e.target.value)} /></label>
          <label className="block"><SectionLabel>Materials (AR)</SectionLabel><input dir="rtl" className={cn(input, "text-right")} value={f.materialsAr} onChange={(e) => set("materialsAr", e.target.value)} /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><SectionLabel>Details (EN)</SectionLabel><textarea rows={2} className={cn(input, "resize-y")} value={f.details} onChange={(e) => set("details", e.target.value)} /></label>
          <label className="block"><SectionLabel>Details (AR)</SectionLabel><textarea dir="rtl" rows={2} className={cn(input, "resize-y text-right")} value={f.detailsAr} onChange={(e) => set("detailsAr", e.target.value)} /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><SectionLabel>Model size</SectionLabel><input className={input} value={f.modelSize} onChange={(e) => set("modelSize", e.target.value)} /></label>
          <label className="block"><SectionLabel>Packaging</SectionLabel><input className={input} value={f.packaging} onChange={(e) => set("packaging", e.target.value)} /></label>
        </div>
        <label className="block"><SectionLabel>Tags (comma-separated)</SectionLabel><input className={input} value={f.tagsStr} onChange={(e) => set("tagsStr", e.target.value)} placeholder="new, summer, linen" /></label>
        <div className="flex gap-6 pt-1">
          <label className="flex items-center gap-2 text-[13px] text-foreground"><input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured <span className="text-faint">(shows on homepage)</span></label>
          <label className="flex items-center gap-2 text-[13px] text-foreground"><input type="checkbox" checked={f.onSale} onChange={(e) => set("onSale", e.target.checked)} /> On sale</label>
        </div>
      </Panel>

      <VariantMatrixPanel
        options={options}
        mode={isCreate ? "create" : "edit"}
        productId={product?.id}
        existingKeys={existingKeys}
        onSpecChange={setSpec}
      />

      {isCreate && (
        <Panel className="space-y-4 p-5">
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
