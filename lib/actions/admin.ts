"use server";

import { revalidatePath, updateTag } from "next/cache";
import { authorize } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";
import { sendOrderConfirmation } from "@/lib/email";

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
  // Stock drives the size availability and "Out of stock" badge on cached product and
  // collection pages, so the storefront copies have to be expired too.
  updateTag("products");
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
  // "featured" changes the homepage grid and "on_sale" both the Sale collection and
  // whether the Sale link appears in the nav at all.
  updateTag("products");
  updateTag("nav");
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

/** Re-email the order receipt to the buyer (force-sends past the emailEnabled toggle). */
export async function resendReceipt(orderId: string) {
  const actor = await authorize("orders:write");
  const res = await sendOrderConfirmation(orderId, { force: true });
  if (!res.ok) {
    // Don't write a misleading "sent" audit line, and surface the failure to the admin UI.
    console.error("[admin] resendReceipt did not send", { orderId, reason: res.reason });
    return { ok: false, error: res.reason ?? "send-error" };
  }
  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "order.receipt.resend",
    resourceType: "order",
    resourceId: orderId,
    summary: "Resent receipt to buyer",
  });
  revalidatePath("/admin/orders");
  return { ok: true };
}
