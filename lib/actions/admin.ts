"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";

export async function updateVariantStock(variantId: string, stock: number) {
  const actor = await authorize("inventory:write");
  const s = Math.max(0, Math.floor(stock));
  await supabase.from("variants").update({ stock: s, available: s > 0 }).eq("id", variantId);
  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "variant.stock",
    resourceType: "variant",
    resourceId: variantId,
    summary: `Set stock to ${s}`,
    metadata: { stock: s },
  });
  revalidatePath("/admin/products");
  return { ok: true };
}

export async function updateProductFlags(
  productId: string,
  data: { featured?: boolean; onSale?: boolean },
) {
  const actor = await authorize("products:write");
  const patch: { featured?: boolean; on_sale?: boolean } = {};
  if (data.featured != null) patch.featured = data.featured;
  if (data.onSale != null) patch.on_sale = data.onSale;
  await supabase.from("products").update(patch).eq("id", productId);
  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.flags",
    resourceType: "product",
    resourceId: productId,
    summary: "Updated product flags",
    metadata: patch,
  });
  revalidatePath("/admin/products");
  return { ok: true };
}

export async function updateOrder(
  orderId: string,
  data: { status?: string; trackingNumber?: string },
) {
  const actor = await authorize("orders:write");
  await supabase
    .from("orders")
    .update({ status: data.status, tracking_number: data.trackingNumber || null })
    .eq("id", orderId);
  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "order.update",
    resourceType: "order",
    resourceId: orderId,
    summary: data.status ? `Status → ${data.status}` : "Updated order",
    metadata: { ...data },
  });
  revalidatePath("/admin/orders");
  return { ok: true };
}
