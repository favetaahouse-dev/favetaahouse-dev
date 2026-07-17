"use server";

import { supabase } from "@/lib/supabase";
import { getOrCreateCart, cartStateById, getCart, type CartState } from "@/lib/data/cart";

export async function addToCartAction(
  variantId: string,
  quantity = 1,
  length?: number,
  tackTack = false,
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
  return { ok: true, cart: await cartStateById(cart.id!) };
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
