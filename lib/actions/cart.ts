"use server";

import { supabase } from "@/lib/supabase";
import { getOrCreateCart, cartStateById, getCart, type CartState } from "@/lib/data/cart";
import { sendMetaAddToCart } from "@/lib/meta/server-events";
import { addToCartPayload } from "@/lib/meta/events";

/** Meta dedup key + originating URL, supplied by the browser so both halves share an event_id. */
export type AddToCartMeta = { eventId: string; eventSourceUrl?: string; fbc?: string };

export async function addToCartAction(
  variantId: string,
  quantity = 1,
  length?: number,
  tackTack = false,
  meta?: AddToCartMeta,
): Promise<{ ok: boolean; cart: CartState; error?: string }> {
  const cart = await getOrCreateCart();
  const { data: variant } = await supabase
    .from("variants")
    .select("available, stock")
    .eq("id", variantId)
    .maybeSingle();
  if (!variant || !variant.available || variant.stock < 1) {
    return { ok: false, cart: await cartStateById(cart.id!), error: "unavailable" };
  }
  // A line is a (variant, length, tack-tack) choice — same size in two lengths = two lines.
  const len = length ?? null;
  const existing = cart.items.find(
    (i) => i.variantId === variantId && i.length === len && i.tackTack === tackTack,
  );
  const nextQty = Math.min((existing?.quantity ?? 0) + quantity, variant.stock);
  await supabase
    .from("cart_items")
    .upsert(
      { cart_id: cart.id!, variant_id: variantId, quantity: nextQty, length: len, tack_tack: tackTack },
      { onConflict: "cart_id,variant_id,length,tack_tack" },
    );
  const next = await cartStateById(cart.id!);

  // Meta AddToCart, server side. Costs no extra queries: the line we just wrote is already in
  // `next`, carrying handle, title and price. Awaited rather than floated because a floating
  // promise is not guaranteed to run on Vercel — the function can be frozen the moment this
  // action returns. It can never throw (see lib/meta/capi.ts).
  if (meta?.eventId) {
    const line = next.items.find(
      (i) => i.variantId === variantId && i.length === (length ?? null) && i.tackTack === tackTack,
    );
    if (line) {
      await sendMetaAddToCart({
        eventId: meta.eventId,
        eventSourceUrl: meta.eventSourceUrl,
        clientFbc: meta.fbc,
        payload: addToCartPayload({
          handle: line.handle,
          title: line.title,
          priceFils: line.price,
          // The incremental add, not the line's new total — Meta's AddToCart is about what was
          // just added, and `nextQty` above is cumulative for an existing line.
          quantity,
        }),
      });
    }
  }

  return { ok: true, cart: next };
}

export async function updateCartItemAction(itemId: string, quantity: number): Promise<CartState> {
  const { data: item } = await supabase
    .from("cart_items")
    .select("id, cart_id, variant:variants(stock)")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return getCart();
  if (quantity <= 0) {
    await supabase.from("cart_items").delete().eq("id", itemId);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stock = (item.variant as any)?.stock ?? quantity;
    await supabase.from("cart_items").update({ quantity: Math.min(quantity, stock) }).eq("id", itemId);
  }
  return cartStateById(item.cart_id as string);
}

export async function removeCartItemAction(itemId: string): Promise<CartState> {
  const { data: item } = await supabase.from("cart_items").select("cart_id").eq("id", itemId).maybeSingle();
  if (!item) return getCart();
  await supabase.from("cart_items").delete().eq("id", itemId);
  return cartStateById(item.cart_id as string);
}

export async function refreshCartAction(): Promise<CartState> {
  return getCart();
}
