"use server";

import { revalidatePath, updateTag } from "next/cache";
import { authorize } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";

/**
 * Manually adjust a variant's stock — by a delta (±) or to an absolute value.
 * Atomic via the adjust_stock RPC, which also writes an inventory_adjustments row.
 */
export async function adjustStock(input: {
  variantId: string;
  delta?: number;
  set?: number;
  reason?: string;
  note?: string;
}) {
  const actor = await authorize("inventory:write");
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_variant_id: input.variantId,
    p_delta: input.delta ?? 0,
    p_reason: input.reason ?? "manual",
    p_note: input.note ?? undefined,
    p_actor_id: actor.id,
    p_actor_email: actor.email,
    p_set: input.set ?? undefined,
  });
  if (error) throw new Error(error.message);
  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "inventory.adjust",
    resourceType: "variant",
    resourceId: input.variantId,
    summary:
      input.set != null
        ? `Set stock to ${input.set}`
        : `Adjust stock ${(input.delta ?? 0) >= 0 ? "+" : ""}${input.delta ?? 0}`,
    metadata: { ...input },
  });
  // Stock decides the greyed-out sizes and the "Out of stock" badge, both of which are
  // baked into cached product/collection pages — expire them so the change is visible.
  updateTag("products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  return { ok: true, stock: data as number };
}
