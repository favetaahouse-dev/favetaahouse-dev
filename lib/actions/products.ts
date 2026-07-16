"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";

function slugify(s: string): string {
  return (
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) ||
    `product-${Date.now().toString(36)}`
  );
}

export type ProductInput = {
  title: string; titleAr?: string | null; handle?: string;
  description?: string | null; descriptionAr?: string | null; productCode?: string | null;
  materials?: string | null; materialsAr?: string | null; modelSize?: string | null;
  details?: string | null; detailsAr?: string | null; packaging?: string | null;
  category: string; status: string; tags?: string[]; featured?: boolean; onSale?: boolean;
};

const FIELD_MAP: Record<string, string> = {
  title: "title", titleAr: "title_ar", handle: "handle",
  description: "description", descriptionAr: "description_ar", productCode: "product_code",
  materials: "materials", materialsAr: "materials_ar", modelSize: "model_size",
  details: "details", detailsAr: "details_ar", packaging: "packaging",
  category: "category", status: "status", tags: "tags",
};

export type VariantSeed = {
  color?: string; colorHex?: string | null; size?: string; sku?: string | null; price: number; stock: number;
};

export async function createProduct(input: ProductInput, initialVariants?: VariantSeed[]) {
  const actor = await authorize("products:write");
  let handle = input.handle?.trim() || slugify(input.title);
  const { data: existing } = await supabase.from("products").select("id").eq("handle", handle).maybeSingle();
  if (existing) handle = `${handle}-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("products")
    .insert({
      handle, title: input.title, title_ar: input.titleAr ?? null,
      description: input.description ?? null, description_ar: input.descriptionAr ?? null,
      product_code: input.productCode ?? null, materials: input.materials ?? null,
      materials_ar: input.materialsAr ?? null, model_size: input.modelSize ?? null,
      details: input.details ?? null, details_ar: input.detailsAr ?? null,
      packaging: input.packaging ?? null, category: input.category, status: input.status,
      tags: input.tags ?? [], featured: !!input.featured, on_sale: !!input.onSale,
      price_min: 0, price_max: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = data.id as string;

  // Seed the color×size variants so the product has stock, a price, and is sellable.
  if (initialVariants && initialVariants.length) {
    const seen = new Set<string>();
    const rows = initialVariants
      .map((v, i) => {
        const stock = Math.max(0, Math.floor(v.stock || 0));
        return {
          product_id: id,
          color: v.color?.trim() || "Default",
          color_hex: v.colorHex ?? null,
          size: v.size?.trim() || "One Size",
          sku: v.sku ?? null,
          price: Math.max(0, Math.floor(v.price || 0)),
          compare_at: null,
          stock,
          available: stock > 0,
          position: i,
        };
      })
      .filter((r) => {
        const k = `${r.color}|||${r.size}`; // respect the (product, color, size) unique constraint
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (rows.length) await supabase.from("variants").insert(rows);
    await recomputePrices(id);
  }

  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "product.create",
    resourceType: "product", resourceId: id, summary: `Created ${input.title}`,
  });
  revalidatePath("/admin/products");
  return { ok: true, id };
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  const actor = await authorize("products:write");
  const patch: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(FIELD_MAP)) {
    if (k in input) patch[col] = (input as Record<string, unknown>)[k];
  }
  if ("featured" in input) patch.featured = !!input.featured;
  if ("onSale" in input) patch.on_sale = !!input.onSale;
  await supabase.from("products").update(patch as never).eq("id", id);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "product.update",
    resourceType: "product", resourceId: id, summary: "Updated product",
    metadata: { fields: Object.keys(patch) },
  });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  return { ok: true };
}

export async function deleteProduct(id: string) {
  const actor = await authorize("products:delete");
  await supabase.from("products").delete().eq("id", id);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "product.delete",
    resourceType: "product", resourceId: id, summary: "Deleted product",
  });
  revalidatePath("/admin/products");
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
    await supabase.from("variants").insert(
      variants.map((v) => {
        const vr = { ...(v as Record<string, unknown>) };
        delete vr.id; delete vr.created_at;
        return { ...vr, product_id: np.id };
      }) as never,
    );
  }
  if (images?.length) {
    await supabase.from("product_images").insert(
      images.map((im) => {
        const ir = { ...(im as Record<string, unknown>) };
        delete ir.id;
        return { ...ir, product_id: np.id };
      }) as never,
    );
  }
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "product.duplicate",
    resourceType: "product", resourceId: np.id, summary: `Duplicated ${p.title}`,
  });
  revalidatePath("/admin/products");
  return { ok: true, id: np.id as string };
}

async function recomputePrices(productId: string) {
  const { data } = await supabase.from("variants").select("price").eq("product_id", productId);
  const prices = (data ?? []).map((v) => v.price);
  await supabase
    .from("products")
    .update({ price_min: prices.length ? Math.min(...prices) : 0, price_max: prices.length ? Math.max(...prices) : 0 })
    .eq("id", productId);
}

export async function upsertVariant(
  productId: string,
  v: { id?: string; color: string; colorHex?: string | null; size: string; sku?: string | null; price: number; compareAt?: number | null; stock?: number; position?: number },
) {
  const actor = await authorize("products:write");
  const stock = Math.max(0, Math.floor(v.stock ?? 0));
  const row = {
    product_id: productId, color: v.color, color_hex: v.colorHex ?? null, size: v.size,
    sku: v.sku ?? null, price: Math.max(0, Math.floor(v.price)), compare_at: v.compareAt ?? null,
    stock, available: stock > 0, position: v.position ?? 0,
  };
  if (v.id) await supabase.from("variants").update(row).eq("id", v.id);
  else await supabase.from("variants").insert(row);
  await recomputePrices(productId);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: v.id ? "variant.update" : "variant.create",
    resourceType: "product", resourceId: productId, summary: `${v.color} / ${v.size}`,
  });
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true };
}

export async function deleteVariant(productId: string, variantId: string) {
  const actor = await authorize("products:write");
  await supabase.from("variants").delete().eq("id", variantId);
  await recomputePrices(productId);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: "variant.delete",
    resourceType: "product", resourceId: productId,
  });
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true };
}

export type BulkAction = "archive" | "activate" | "draft" | "delete" | "feature" | "unfeature";

export async function bulkProductAction(ids: string[], action: BulkAction) {
  const actor = await authorize(action === "delete" ? "products:delete" : "products:write");
  if (!ids.length) return { ok: true };
  const q = supabase.from("products");
  if (action === "delete") await q.delete().in("id", ids);
  else if (action === "archive") await q.update({ status: "archived" }).in("id", ids);
  else if (action === "activate") await q.update({ status: "active" }).in("id", ids);
  else if (action === "draft") await q.update({ status: "draft" }).in("id", ids);
  else if (action === "feature") await q.update({ featured: true }).in("id", ids);
  else if (action === "unfeature") await q.update({ featured: false }).in("id", ids);
  await logAudit({
    actorId: actor.id, actorEmail: actor.email, action: `product.bulk.${action}`,
    summary: `${action} ${ids.length} products`, metadata: { ids },
  });
  revalidatePath("/admin/products");
  return { ok: true };
}
