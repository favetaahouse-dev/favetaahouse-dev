"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Panel, PanelHeader, FieldLabel, Spinner, fieldInput } from "./ui";
import { createProduct, updateProduct, type ProductInput } from "@/lib/actions/products";
import { VariantMatrixPanel, type MatrixSpec } from "./VariantMatrixPanel";
import { ColorsPanel } from "./ColorsPanel";
import type { AdminProduct } from "@/lib/data/admin-catalog";
import { normalizeCategory } from "@/lib/categories";
import { PRICE_INPUT_HINT, parsePriceStrict } from "@/lib/money";
import { cn } from "@/lib/utils";

const STATUSES = ["active", "draft", "archived"] as const;
const input = fieldInput;

/**
 * An English field beside its Arabic twin, inside ONE bordered box under ONE label.
 *
 * They used to be two separate labelled fields sitting in a 2-column grid — two identical
 * boxes whose only distinction was the "(EN)"/"(AR)" suffix on two identical-looking labels.
 * Bracketing them says "these are one thing in two languages" structurally, and the EN/AR
 * affixes say which is which without reading anything.
 *
 * `lang="ar"` alongside `dir="rtl"`: rtl lays the text out, lang is what makes a screen
 * reader switch voice instead of spelling Arabic with an English one.
 */
function Bilingual({
  label,
  required,
  hint,
  en,
  ar,
  onEn,
  onAr,
  rows,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  en: string;
  ar: string;
  onEn: (v: string) => void;
  onAr: (v: string) => void;
  /** Set for a textarea pair; omit for single-line inputs. */
  rows?: number;
}) {
  const cell =
    "w-full bg-canvas px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-faint focus:bg-elevated/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";
  const affix =
    "pointer-events-none absolute top-1.5 text-[9px] font-medium uppercase tracking-[0.12em] text-faint";
  const Field = rows ? "textarea" : "input";
  return (
    <div>
      <FieldLabel required={required} hint={hint}>{label}</FieldLabel>
      <div className="grid border border-field sm:grid-cols-2">
        <div className="relative border-b border-field sm:border-b-0 sm:border-e">
          <span className={cn(affix, "end-2")}>EN</span>
          <Field
            rows={rows}
            aria-label={`${label} (English)`}
            className={cn(cell, rows && "resize-y", "pe-8")}
            value={en}
            onChange={(e) => onEn(e.target.value)}
          />
        </div>
        <div className="relative">
          <span className={cn(affix, "start-2")}>AR</span>
          <Field
            rows={rows}
            dir="rtl"
            lang="ar"
            aria-label={`${label} (Arabic)`}
            className={cn(cell, rows && "resize-y", "ps-8 text-right")}
            value={ar}
            onChange={(e) => onAr(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

/** Whole non-negative days, or null for "use the house default". Blank must not read as 0. */
function intOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function ProductForm({
  product,
  options,
  categories,
  measureFields = [],
  canEditProducts = true,
}: {
  product?: AdminProduct;
  options: { sizes: string[]; lengths: number[] };
  categories: string[];
  /** The CMS measurement list, already localised to English for the admin. */
  measureFields?: { key: string; label: string }[];
  canEditProducts?: boolean;
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
    // Mirrors the column default: the house is made-to-order first, so that is what a new
    // product is unless the owner says otherwise.
    fulfillment: product?.fulfillment ?? "MADE_TO_ORDER",
    // Prices as raw STRINGS, like VariantGrid: parsePriceStrict must be able to tell "typed
    // nothing" from "typed zero", and a number input collapses the two into 0.
    mtoPriceStr: product?.mtoPrice != null ? (product.mtoPrice / 100).toFixed(2) : "",
    mtoCompareStr: product?.mtoCompareAt != null ? (product.mtoCompareAt / 100).toFixed(2) : "",
    mtoLeadMinStr: product?.mtoLeadMin != null ? String(product.mtoLeadMin) : "",
    mtoLeadMaxStr: product?.mtoLeadMax != null ? String(product.mtoLeadMax) : "",
    mtoFields: product?.mtoFields ?? [],
  });
  const set = (k: keyof typeof f, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const offersMto = f.fulfillment !== "READY_TO_WEAR";
  const offersRtw = f.fulfillment !== "MADE_TO_ORDER";

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
    fulfillment: f.fulfillment as ProductInput["fulfillment"],
    // Cleared boxes send null, not 0 — turning a made-to-order product back into a
    // ready-to-wear one has to be able to remove the price, not zero it.
    mtoPrice: offersMto ? parsePriceStrict(f.mtoPriceStr) : null,
    mtoCompareAt: offersMto ? parsePriceStrict(f.mtoCompareStr) : null,
    mtoLeadMin: intOrNull(f.mtoLeadMinStr),
    mtoLeadMax: intOrNull(f.mtoLeadMaxStr),
    mtoFields: f.mtoFields,
  });

  const submit = async () => {
    if (!f.title.trim()) return toast.error("Title is required");
    // The server refuses this too (assertMtoConsistent), but an owner should hear it from the
    // box they left empty rather than from a failed save.
    if (offersMto && parsePriceStrict(f.mtoPriceStr) === null) {
      return toast.error(`Enter a made-to-order price — ${PRICE_INPUT_HINT}`);
    }
    setSaving(true);
    try {
      if (product) {
        await updateProduct(product.id, payload());
        toast.success("Saved");
        router.refresh();
        return;
      }
      // Sizes are a READY-TO-WEAR requirement. A made-to-order-only product has colours and no
      // size axis at all, and demanding one was the single most incoherent thing about creating
      // one before this existed.
      if (!spec?.colors.length) return toast.error("Add at least one colour");
      if (offersRtw && !spec.sizes.length) return toast.error("Pick at least one size for the variants");
      // Same guard the edit-mode generator has: a blank price box used to create every variant of
      // a brand-new product at QAR 0.00, published, with nothing said.
      if (offersRtw && spec.price === null) return toast.error(`Enter a variant price — ${PRICE_INPUT_HINT}`);
      const res = await createProduct(payload(), {
        ...spec,
        sizes: offersRtw ? spec.sizes : [],
        price: spec.price ?? 0,
      });

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

  // A value, not a component — `saving` and `submit` stay in this closure, so rendering it in
  // one branch or the other cannot remount anything. It says WHAT it saves because there is a
  // second Save further down the page that owns prices and quantities; "Save changes" on both
  // was the page's single most misleading detail.
  const saveRow = (
    <Button variant="primary" onClick={submit} disabled={saving}>
      {saving && <Spinner />}
      {saving ? "Saving…" : product ? "Save product details" : "Create product"}
    </Button>
  );

  const fileInput =
    "block w-full text-[13px] text-secondary file:mr-3 file:border file:border-field file:bg-elevated file:px-3 file:py-1.5 file:text-foreground";

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          title="Product details"
          description="Catalogue text and the copy shown on the storefront. Colours, sizes, prices and photos are set in the panels below."
        />
        <div className="space-y-5 p-5">
          <Bilingual
            label="Title"
            required
            en={f.title}
            ar={f.titleAr}
            onEn={(v) => set("title", v)}
            onAr={(v) => set("titleAr", v)}
          />
          <Bilingual
            label="Description"
            rows={3}
            en={f.description}
            ar={f.descriptionAr}
            onEn={(v) => set("description", v)}
            onAr={(v) => set("descriptionAr", v)}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              {/* The format rule was a placeholder, which disappears the moment you type the
                  first letter — exactly when you still need it. */}
              <FieldLabel hint="Pick an existing one or type a new name.">Category</FieldLabel>
              <input className={input} list="category-options" value={f.category} onChange={(e) => set("category", e.target.value)} onBlur={(e) => set("category", normalizeCategory(e.target.value))} placeholder="ABAYA" />
              <datalist id="category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="block">
              <FieldLabel hint="Draft and archived products are hidden from the shop.">Status</FieldLabel>
              <select className={input} value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="block">
              <FieldLabel>Product code</FieldLabel>
              <input className={input} value={f.productCode} onChange={(e) => set("productCode", e.target.value)} />
            </label>
          </div>
          <Bilingual
            label="Materials"
            en={f.materials}
            ar={f.materialsAr}
            onEn={(v) => set("materials", v)}
            onAr={(v) => set("materialsAr", v)}
          />
          <Bilingual
            label="Details"
            rows={2}
            en={f.details}
            ar={f.detailsAr}
            onEn={(v) => set("details", v)}
            onAr={(v) => set("detailsAr", v)}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><FieldLabel>Model size</FieldLabel><input className={input} value={f.modelSize} onChange={(e) => set("modelSize", e.target.value)} /></label>
            <label className="block"><FieldLabel>Packaging</FieldLabel><input className={input} value={f.packaging} onChange={(e) => set("packaging", e.target.value)} /></label>
          </div>
          <label className="block">
            <FieldLabel hint="Separate each tag with a comma.">Tags</FieldLabel>
            <input className={input} value={f.tagsStr} onChange={(e) => set("tagsStr", e.target.value)} placeholder="new, summer, linen" />
          </label>
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-edge pt-4">
            <label className="flex items-start gap-2.5 text-[13px] text-foreground">
              <input type="checkbox" className="mt-0.5 accent-accent" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} />
              <span>Featured<span className="block text-[11px] text-secondary">Shows in the homepage carousel.</span></span>
            </label>
            <label className="flex items-start gap-2.5 text-[13px] text-foreground">
              <input type="checkbox" className="mt-0.5 accent-accent" checked={f.onSale} onChange={(e) => set("onSale", e.target.checked)} />
              <span>On sale<span className="block text-[11px] text-secondary">Marks the product with a sale badge.</span></span>
            </label>
          </div>
        </div>
        {/* Edit mode: the Save lives in this panel's own footer, so what it owns is structural
            rather than something the label has to claim. It used to float between two panels it
            has no authority over, reading as the terminal action for the whole page.
            Safe because in edit mode submit() returns before it ever reads `spec` or the files. */}
        {!isCreate && (
          <div className="flex justify-end border-t border-edge px-5 py-3">{saveRow}</div>
        )}
      </Panel>

      {/* Placed before the variant panels because it decides whether they render at all. */}
      <Panel>
        <PanelHeader
          title="How it's made"
          description="Made-to-order pieces are cut to the customer's measurements after the sale, carry their own price, and are never out of stock."
        />
        <div className="space-y-4 p-5">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Fulfilment">
            {([
              ["MADE_TO_ORDER", "Made to order only", "Colours and measurements. No sizes, no stock."],
              ["BOTH", "Both", "Shoppers choose on the product page."],
              ["READY_TO_WEAR", "Ready to wear only", "Stocked sizes, as before."],
            ] as const).map(([value, label, sub]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={f.fulfillment === value}
                onClick={() => set("fulfillment", value)}
                className={cn(
                  "border px-3.5 py-3 text-start transition-colors",
                  f.fulfillment === value ? "border-accent bg-raised" : "border-field hover:border-accent",
                )}
              >
                <span className="block text-[13px] text-foreground">{label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-secondary">{sub}</span>
              </button>
            ))}
          </div>

          {offersMto && (
            <>
              <div className="grid gap-4 border-t border-edge pt-4 md:grid-cols-2">
                <label className="block">
                  <FieldLabel hint={PRICE_INPUT_HINT}>Made-to-order price (QAR)</FieldLabel>
                  <input className={input} inputMode="decimal" value={f.mtoPriceStr} onChange={(e) => set("mtoPriceStr", e.target.value)} placeholder="1200.00" />
                </label>
                <label className="block">
                  <FieldLabel hint="Optional. Shown struck through beside the price.">Compare at (QAR)</FieldLabel>
                  <input className={input} inputMode="decimal" value={f.mtoCompareStr} onChange={(e) => set("mtoCompareStr", e.target.value)} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <FieldLabel hint="Leave blank to use the house default from Content → Made to Order.">Production time — from (days)</FieldLabel>
                  <input className={input} type="number" min={0} value={f.mtoLeadMinStr} onChange={(e) => set("mtoLeadMinStr", e.target.value)} />
                </label>
                <label className="block">
                  <FieldLabel>Production time — to (days)</FieldLabel>
                  <input className={input} type="number" min={0} value={f.mtoLeadMaxStr} onChange={(e) => set("mtoLeadMaxStr", e.target.value)} />
                </label>
              </div>
              <div>
                <FieldLabel hint="Which measurements this piece needs. Select none to ask for all of them.">
                  Measurements asked for
                </FieldLabel>
                {measureFields.length === 0 ? (
                  <p className="text-[12px] text-secondary">
                    No measurements defined yet — add them under Content → Made to Order.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {measureFields.map((m) => {
                      const on = f.mtoFields.includes(m.key);
                      return (
                        <button
                          key={m.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            set(
                              "mtoFields",
                              on ? f.mtoFields.filter((k) => k !== m.key) : [...f.mtoFields, m.key],
                            )
                          }
                          className={cn(
                            "border px-2.5 py-1.5 text-[12px] transition-colors",
                            on ? "border-accent bg-raised text-foreground" : "border-field text-secondary hover:border-accent",
                          )}
                        >
                          {on && "✓ "}
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Panel>

      {/* Colour is the one axis both modes share, so this renders whatever the mode. In edit
          mode it manages the saved list; in create mode the matrix below still collects them,
          because there is no product id to attach them to yet. */}
      {!isCreate && product && (
        <ColorsPanel
          productId={product.id}
          canEdit={canEditProducts}
          initial={product.colors.map((c) => ({
            id: c.id,
            name: c.name,
            nameAr: c.nameAr ?? "",
            hex: c.hex ?? "#000000",
            variantCount: product.variants.filter((v) => v.color === c.name).length,
          }))}
        />
      )}

      {/* Sizes and stock are a ready-to-wear concern. A made-to-order-only product has neither,
          and rendering an empty stock grid beside it was the incoherence Option A removed. */}
      {(offersRtw || isCreate) && (
        <VariantMatrixPanel
          options={options}
          mode={isCreate ? "create" : "edit"}
          productId={product?.id}
          existingKeys={existingKeys}
          onSpecChange={setSpec}
          sizesDisabled={!offersRtw}
        />
      )}

      {isCreate && (
        <Panel>
          <PanelHeader title="Photos" description="The cover is the photo shoppers see in the catalogue. You can add and reorder more after the product is created." />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <label className="block">
              <FieldLabel>Cover image (main photo)</FieldLabel>
              <input type="file" accept="image/*" className={fileInput} onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
              {cover && <span className="mt-1 block text-[11px] text-secondary">{cover.name}</span>}
            </label>
            <label className="block">
              <FieldLabel>Gallery images</FieldLabel>
              <input type="file" accept="image/*" multiple className={fileInput} onChange={(e) => setGallery([...(e.target.files ?? [])])} />
              {gallery.length > 0 && <span className="mt-1 block text-[11px] text-secondary">{gallery.length} image(s)</span>}
            </label>
          </div>
        </Panel>
      )}

      {/* Create mode keeps it terminal: here submit() genuinely does consume the variant spec
          and both file inputs, so it really is the action for everything above it. */}
      {isCreate && <div className="flex justify-end">{saveRow}</div>}
    </div>
  );
}
