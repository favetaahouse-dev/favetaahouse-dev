"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { authorize } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";
import { getVariantOptions } from "@/lib/content";
import { normalizeCategory } from "@/lib/categories";
import { MAX_PRICE_FILS } from "@/lib/money";
// A plain server module, not an action — see the note at the top of that file for why this one
// cannot live in this "use server" file.
import { recomputePrices } from "@/lib/data/product-pricing";

function slugify(s: string): string {
  return (
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) ||
    `product-${Date.now().toString(36)}`
  );
}

/**
 * Push an admin edit out to the public site.
 *
 * Storefront product data is cached under the "products" tag (lib/data/catalog.ts,
 * lib/data/collections.ts). updateTag expires it so the next request re-reads rather than
 * serving the stale copy — the read-your-own-writes behaviour an admin expects after
 * hitting Save. The nav is tagged separately because adding the first product in a
 * category, or the first sale item, changes which links appear.
 */
function revalidateAll(productId?: string) {
  updateTag("products");
  updateTag("nav");
  revalidatePath("/admin/products");
  if (productId) revalidatePath(`/admin/products/${productId}`);
}

// ── validation ──────────────────────────────────────────────────────────────
// Server actions are public endpoints; validate before touching the DB. `category` is now
// free text (the CHECK was dropped in 20260719120000_dynamic_categories.sql): normalize to the
// canonical UPPERCASE form and bound the charset so a stray value is a clean 4xx, not garbage.
// `status` still mirrors its CHECK constraint.
const categorySchema = z
  .string()
  .trim()
  .min(1, "Category is required")
  .transform(normalizeCategory)
  .refine((v) => /^[A-Z0-9 &-]{1,40}$/.test(v), "Category may only contain letters, numbers, spaces, & and -");

const productInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  titleAr: z.string().nullish(),
  handle: z.string().trim().optional(),
  description: z.string().nullish(),
  descriptionAr: z.string().nullish(),
  productCode: z.string().nullish(),
  materials: z.string().nullish(),
  materialsAr: z.string().nullish(),
  modelSize: z.string().nullish(),
  details: z.string().nullish(),
  detailsAr: z.string().nullish(),
  packaging: z.string().nullish(),
  category: categorySchema,
  status: z.enum(["active", "draft", "archived"]),
  tags: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  onSale: z.boolean().optional(),
});
export type ProductInput = z.infer<typeof productInputSchema>;

const MAX_CELLS = 1000;
const variantSpecSchema = z
  .object({
    colors: z.array(z.object({ name: z.string().trim().min(1), hex: z.string().nullish() })).min(1),
    sizes: z.array(z.string().trim().min(1)).min(1),
    // min(0) stays: an explicitly free item is legal. Blocking the ACCIDENTAL zero (an empty
    // price box) is the client's job, where "typed nothing" and "typed zero" are still distinct.
    price: z.number().int().min(0).max(MAX_PRICE_FILS),
    stock: z.number().int().min(0),
  })
  .refine((s) => s.colors.length * s.sizes.length <= MAX_CELLS, {
    message: `That combination exceeds ${MAX_CELLS} variants. Narrow the sizes or colours.`,
  });
export type VariantSpec = z.infer<typeof variantSpecSchema>;

const FIELD_MAP: Record<string, string> = {
  title: "title", titleAr: "title_ar", handle: "handle",
  description: "description", descriptionAr: "description_ar", productCode: "product_code",
  materials: "materials", materialsAr: "materials_ar", modelSize: "model_size",
  details: "details", detailsAr: "details_ar", packaging: "packaging",
  category: "category", status: "status", tags: "tags",
};

/**
 * Assert every id belongs to `productId`, and hand back the de-duplicated list.
 *
 * Server actions are public endpoints, and setVariantStock / setVariantPrice(s) / deleteVariants
 * all address rows by id ALONE — so without this, knowing a variant UUID is enough to reprice or
 * delete a variant of somebody else's product, from any authenticated staff session. `productId`
 * needs no such check of its own: it only decides which product's price range gets recomputed.
 *
 * It reads the product's OWN id list rather than filtering `.in("id", ids)`, for two reasons:
 * a thousand UUIDs in an `.in()` builds a ~37 KB query string that proxies reject, and `.in()`
 * results are subject to the very same silent PostgREST row cap being fixed in
 * lib/data/product-pricing.ts — a truncated result would report false "not yours" errors. A
 * product's own variant list is colours x sizes, which MAX_CELLS already bounds.
 *
 * TOCTOU is not a live risk here: nothing in this codebase ever UPDATEs variants.product_id, so a
 * row cannot be reparented between this check and the write. Revisit if that ever changes.
 */
async function assertVariantsOwned(productId: string, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return unique;
  const { data, error } = await supabase
    .from("variants")
    .select("id")
    .eq("product_id", productId)
    .limit(MAX_CELLS + 1);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length > MAX_CELLS) {
    throw new Error(`This product has more than ${MAX_CELLS} variants — edit it in smaller batches.`);
  }
  const owned = new Set(rows.map((r) => r.id as string));
  const bad = unique.filter((id) => !owned.has(id));
  if (bad.length) {
    throw new Error(`${bad.length} variant(s) do not belong to this product`);
  }
  return unique;
}

/** Reject any size not in the admin-managed list — this is where the "picker" is actually
 *  enforced; the client control is only a suggestion. */
async function assertOptionsAllowed(sizes: string[]) {
  const opt = await getVariantOptions();
  const badSize = sizes.find((s) => !opt.sizes.includes(s));
  if (badSize) throw new Error(`"${badSize}" is not an allowed size. Add it under Content → Sizes & Lengths first.`);
}

/** Create the missing (colour, size) variants for a product. Never touches an existing row's
 *  stock/price (the RPC uses ON CONFLICT DO NOTHING). Returns rows created. */
async function runGenerate(productId: string, spec: VariantSpec): Promise<number> {
  await assertOptionsAllowed(spec.sizes);
  const { data, error } = await supabase.rpc("generate_variants", {
    p_product_id: productId,
    p_colors: spec.colors.map((c) => ({ name: c.name.trim(), hex: c.hex ?? null })),
    p_sizes: spec.sizes,
    p_price: spec.price,
    p_stock: spec.stock,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function createProduct(input: ProductInput, spec?: VariantSpec) {
  const actor = await authorize("products:write");
  const parsed = productInputSchema.parse(input);
  const cleanSpec = spec ? variantSpecSchema.parse(spec) : null;

  let handle = parsed.handle?.trim() || slugify(parsed.title);
  const { data: existing } = await supabase.from("products").select("id").eq("handle", handle).maybeSingle();
  if (existing) handle = `${handle}-${Date.now().toString(36)}`;

  const { data, error } = await supabase
    .from("products")
    .insert({
      handle, title: parsed.title, title_ar: parsed.titleAr ?? null,
      description: parsed.description ?? null, description_ar: parsed.descriptionAr ?? null,
      product_code: parsed.productCode ?? null, materials: parsed.materials ?? null,
      materials_ar: parsed.materialsAr ?? null, model_size: parsed.modelSize ?? null,
      details: parsed.details ?? null, details_ar: parsed.detailsAr ?? null,
      packaging: parsed.packaging ?? null, category: parsed.category, status: parsed.status,
      tags: parsed.tags ?? [], featured: !!parsed.featured, on_sale: !!parsed.onSale,
      price_min: 0, price_max: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = data.id as string;

  if (cleanSpec) await runGenerate(id, cleanSpec);

  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "product.create",
    resourceType: "product", resourceId: id, summary: `Created ${parsed.title}`,
  });
  revalidateAll(id);
  return { ok: true, id };
}

/** Edit-page "Generate variants": create missing combinations for an existing product. */
export async function generateVariants(productId: string, spec: VariantSpec) {
  const actor = await authorize("products:write");
  const clean = variantSpecSchema.parse(spec);
  const created = await runGenerate(productId, clean);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "variant.generate",
    resourceType: "product", resourceId: productId, summary: `Generated ${created} variants`,
    metadata: { created },
  });
  revalidateAll(productId);
  return { ok: true, created };
}

/** Bulk-set stock across many cells in one round-trip (via adjust_stock_bulk, which keeps
 *  `available` in sync and writes the inventory ledger). */
export async function setVariantStock(productId: string, cells: { id: string; stock: number }[]) {
  const actor = await authorize("inventory:write");
  const clean = z.array(z.object({ id: z.string().uuid(), stock: z.number().int().min(0) })).parse(cells);
  if (!clean.length) return { ok: true, changed: 0 };
  // adjust_stock_bulk takes only {id, stock} rows, so ownership is enforced here rather than in
  // the RPC — see assertVariantsOwned for why that is a TS pre-check and not a new SQL argument.
  await assertVariantsOwned(productId, clean.map((c) => c.id));
  const { data, error } = await supabase.rpc("adjust_stock_bulk", {
    p_rows: clean,
    p_reason: "correction",
    p_actor_id: actor.id,
    p_actor_email: actor.email,
  });
  if (error) throw new Error(error.message);
  await recomputePrices(productId);
  revalidateAll(productId);
  return { ok: true, changed: (data as number) ?? 0 };
}

/** Set the advisory product total (size stocks are kept summing ≤ it in the admin UI). */
export async function setProductTotal(productId: string, total: number) {
  const actor = await authorize("products:write");
  const clean = z.number().int().min(0).parse(total);
  const { error } = await supabase.from("products").update({ total_qty: clean }).eq("id", productId);
  if (error) throw new Error(error.message);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "product.total",
    resourceType: "product", resourceId: productId, summary: `Set total quantity to ${clean}`,
  });
  revalidateAll(productId);
  return { ok: true };
}

/** Set the same price on many variant rows in one call. */
export async function setVariantPrice(productId: string, ids: string[], price: number) {
  const actor = await authorize("products:write");
  const clean = z
    .object({ ids: z.array(z.string().uuid()).min(1), price: z.number().int().min(0).max(MAX_PRICE_FILS) })
    .parse({ ids, price });
  await assertVariantsOwned(productId, clean.ids);
  const { error } = await supabase.from("variants").update({ price: clean.price }).in("id", clean.ids);
  if (error) throw new Error(error.message);
  await recomputePrices(productId);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "variant.price",
    resourceType: "product", resourceId: productId, summary: `Set price on ${clean.ids.length} variants`,
  });
  revalidateAll(productId);
  return { ok: true };
}

/**
 * Set a DIFFERENT price per variant in one call — the write behind the grid's single Save button.
 *
 * Chosen over having the client group ids by identical price and call setVariantPrice once per
 * group: that costs a round trip, an authorize(), a recomputePrices() and a revalidateAll() PER
 * DISTINCT PRICE, so a product whose sizes are priced individually would pay one full round trip
 * per variant — the exact slowness the one-button redesign exists to remove. It would also write
 * N audit rows for one owner-visible Save, and a failure at group 3 of 7 would leave the product
 * half-repriced with no way to report which half.
 *
 * The grouping is still done — just here, where it is free: "set every size to 450" collapses to
 * a single UPDATE.
 *
 * Not a transaction. That is safe because every failure this can realistically hit is eliminated
 * BEFORE the first write: shape by zod, ownership by assertVariantsOwned, magnitude by
 * MAX_PRICE_FILS. What is left is losing the connection mid-loop, whose damage is bounded — the
 * recompute never runs, so price_min/max stay consistent with a stale read rather than a wrong
 * one, and the grid resyncs from the server to show exactly which cells landed.
 */
export async function setVariantPrices(productId: string, rows: { id: string; price: number }[]) {
  const actor = await authorize("products:write");
  const clean = z
    .array(z.object({ id: z.string().uuid(), price: z.number().int().min(0).max(MAX_PRICE_FILS) }))
    .min(1)
    .max(MAX_CELLS)
    .parse(rows);
  await assertVariantsOwned(productId, clean.map((r) => r.id));

  const byPrice = new Map<number, string[]>();
  for (const r of clean) byPrice.set(r.price, [...(byPrice.get(r.price) ?? []), r.id]);
  for (const [price, ids] of byPrice) {
    const { error } = await supabase.from("variants").update({ price }).in("id", ids);
    if (error) throw new Error(error.message);
  }

  await recomputePrices(productId);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "variant.price.bulk",
    resourceType: "product", resourceId: productId,
    summary: `Priced ${clean.length} variant(s) across ${byPrice.size} price point(s)`,
    metadata: { count: clean.length, prices: [...byPrice.keys()] },
  });
  revalidateAll(productId);
  return { ok: true, changed: clean.length };
}

/** Delete many variant cells at once (a whole colour or colour+size group). */
export async function deleteVariants(productId: string, ids: string[]) {
  const actor = await authorize("products:write");
  const clean = z.array(z.string().uuid()).min(1).parse(ids);
  await assertVariantsOwned(productId, clean);
  const { error } = await supabase.from("variants").delete().in("id", clean);
  if (error) throw new Error(error.message);
  await recomputePrices(productId);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "variant.delete.bulk",
    resourceType: "product", resourceId: productId, summary: `Deleted ${clean.length} variants`,
  });
  revalidateAll(productId);
  return { ok: true };
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  const actor = await authorize("products:write");
  const parsed = productInputSchema.partial().parse(input);
  const patch: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(FIELD_MAP)) {
    if (k in parsed) patch[col] = (parsed as Record<string, unknown>)[k];
  }
  if ("featured" in parsed) patch.featured = !!parsed.featured;
  if ("onSale" in parsed) patch.on_sale = !!parsed.onSale;
  const { error } = await supabase.from("products").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "product.update",
    resourceType: "product", resourceId: id, summary: "Updated product",
    metadata: { fields: Object.keys(patch) },
  });
  revalidateAll(id);
  return { ok: true };
}

export async function deleteProduct(id: string) {
  const actor = await authorize("products:delete");
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "product.delete",
    resourceType: "product", resourceId: id, summary: "Deleted product",
  });
  revalidateAll();
  return { ok: true };
}

export async function duplicateProduct(id: string) {
  const actor = await authorize("products:write");
  const { data: p } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!p) throw new Error("Product not found");
  const { data: variants } = await supabase.from("variants").select("*").eq("product_id", id);
  const { data: images } = await supabase.from("product_images").select("*").eq("product_id", id);

  const src = p as Record<string, unknown>;
  const rest = { ...src };
  delete rest.id; delete rest.created_at; delete rest.updated_at;
  const newHandle = `${p.handle}-copy-${Date.now().toString(36)}`;
  const { data: np, error } = await supabase
    .from("products")
    .insert({ ...rest, handle: newHandle, title: `${p.title} (Copy)`, status: "draft" } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (variants?.length) {
    const { error: ve } = await supabase.from("variants").insert(
      variants.map((v) => {
        const vr = { ...(v as Record<string, unknown>) };
        delete vr.id; delete vr.created_at;
        return { ...vr, product_id: np.id };
      }) as never,
    );
    if (ve) throw new Error(ve.message);
  }
  if (images?.length) {
    const { error: ie } = await supabase.from("product_images").insert(
      images.map((im) => {
        const ir = { ...(im as Record<string, unknown>) };
        delete ir.id;
        return { ...ir, product_id: np.id };
      }) as never,
    );
    if (ie) throw new Error(ie.message);
  }
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "product.duplicate",
    resourceType: "product", resourceId: np.id, summary: `Duplicated ${p.title}`,
  });
  revalidateAll(np.id as string);
  return { ok: true, id: np.id as string };
}

// `upsertVariant` + its schema used to sit here. Deleted rather than fixed: it had no caller
// anywhere in the repo, and because this file is "use server" it was nonetheless a live public
// endpoint — one that addressed rows by id alone and so carried the same cross-product hole
// assertVariantsOwned exists to close. Removing it closes that instance outright.

export async function deleteVariant(productId: string, variantId: string) {
  const actor = await authorize("products:write");
  // Scoped by product as well as id: the cheap form of assertVariantsOwned for a single row.
  const { error } = await supabase
    .from("variants")
    .delete()
    .eq("id", variantId)
    .eq("product_id", productId);
  if (error) throw new Error(error.message);
  await recomputePrices(productId);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "variant.delete",
    resourceType: "product", resourceId: productId,
  });
  revalidateAll(productId);
  return { ok: true };
}

export type BulkAction = "archive" | "activate" | "draft" | "delete" | "feature" | "unfeature";

export async function bulkProductAction(ids: string[], action: BulkAction) {
  const actor = await authorize(action === "delete" ? "products:delete" : "products:write");
  if (!ids.length) return { ok: true };
  const q = supabase.from("products");
  const run =
    action === "delete" ? q.delete().in("id", ids)
    : action === "archive" ? q.update({ status: "archived" }).in("id", ids)
    : action === "activate" ? q.update({ status: "active" }).in("id", ids)
    : action === "draft" ? q.update({ status: "draft" }).in("id", ids)
    : action === "feature" ? q.update({ featured: true }).in("id", ids)
    : q.update({ featured: false }).in("id", ids);
  const { error } = await run;
  if (error) throw new Error(error.message);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: `product.bulk.${action}`,
    summary: `${action} ${ids.length} products`, metadata: { ids },
  });
  revalidateAll();
  return { ok: true };
}
