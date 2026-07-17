"use server";

import { revalidatePath } from "next/cache";
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
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/", "layout"); // reflect the stock change on the storefront too
  return { ok: true, stock: data as number };
}
