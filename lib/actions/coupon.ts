"use server";

import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { getOrCreateCart, cartStateById, CART_COOKIE, EMPTY_CART, type CartState } from "@/lib/data/cart";
import { computeDiscount, type Coupon } from "@/lib/coupons";

export async function applyCouponAction(
  code: string,
): Promise<{ ok: boolean; cart: CartState; error?: string }> {
  const cart = await getOrCreateCart();
  const normalized = code.toUpperCase().trim();
  const state = await cartStateById(cart.id!);
  if (!normalized) return { ok: false, cart: state, error: "invalid" };

  const { data: c } = await supabase.from("coupons").select("*").eq("code", normalized).maybeSingle();
  if (!c || computeDiscount(c as Coupon, state.subtotal, Date.now()) <= 0) {
    return { ok: false, cart: state, error: "invalid" };
  }
  await supabase.from("carts").update({ coupon_code: normalized }).eq("id", cart.id!);
  return { ok: true, cart: await cartStateById(cart.id!) };
}

export async function removeCouponAction(): Promise<CartState> {
  const store = await cookies();
  const id = store.get(CART_COOKIE)?.value;
  if (id) await supabase.from("carts").update({ coupon_code: null }).eq("id", id);
  return id ? cartStateById(id) : EMPTY_CART;
}
