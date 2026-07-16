import "server-only";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { computeDiscount, type Coupon } from "@/lib/coupons";

export const CART_COOKIE = "cartId";

export type CartLine = {
  id: string;
  variantId: string;
  handle: string;
  title: string;
  color: string;
  size: string;
  price: number;
  compareAt: number | null;
  image: string | null;
  quantity: number;
  maxStock: number;
  available: boolean;
};

export type CartState = {
  id: string | null;
  items: CartLine[];
  count: number;
  subtotal: number;
  couponCode: string | null;
  discount: number;
  total: number;
};

const CART_SELECT =
  "id, coupon_code, items:cart_items(id, quantity, variant:variants(id, color, size, price, compare_at, stock, available, image_url, product:products(handle, title, images:product_images(url, position))))";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCart(cart: any): CartState {
  if (!cart) return { id: null, items: [], count: 0, subtotal: 0, couponCode: null, discount: 0, total: 0 };
  const items: CartLine[] = (cart.items ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((it: any) => {
      const v = it.variant;
      const p = v.product;
      const img =
        v.image_url ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [...(p.images ?? [])].sort((a: any, b: any) => a.position - b.position)[0]?.url ??
        null;
      return {
        id: it.id, variantId: v.id, handle: p.handle, title: p.title, color: v.color, size: v.size,
        price: v.price, compareAt: v.compare_at, image: img, quantity: it.quantity, maxStock: v.stock, available: v.available,
      } as CartLine;
    })
    .sort((a: CartLine, b: CartLine) => a.id.localeCompare(b.id));
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  return {
    id: cart.id,
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    couponCode: cart.coupon_code ?? null,
    discount: 0,
    total: subtotal,
  };
}

async function withCoupon(state: CartState): Promise<CartState> {
  if (!state.couponCode || state.subtotal <= 0) {
    return { ...state, couponCode: state.subtotal > 0 ? state.couponCode : null, discount: 0, total: state.subtotal };
  }
  const { data: c } = await supabase.from("coupons").select("*").eq("code", state.couponCode).maybeSingle();
  const discount = c ? computeDiscount(c as Coupon, state.subtotal, Date.now()) : 0;
  return {
    ...state,
    couponCode: discount > 0 ? state.couponCode : null,
    discount,
    total: Math.max(state.subtotal - discount, 0),
  };
}

export async function getCart(): Promise<CartState> {
  const store = await cookies();
  const id = store.get(CART_COOKIE)?.value;
  if (!id) return mapCart(null);
  const { data } = await supabase.from("carts").select(CART_SELECT).eq("id", id).maybeSingle();
  return withCoupon(mapCart(data));
}

export async function getOrCreateCart(): Promise<CartState> {
  const store = await cookies();
  const id = store.get(CART_COOKIE)?.value;
  if (id) {
    const { data } = await supabase.from("carts").select(CART_SELECT).eq("id", id).maybeSingle();
    if (data) return withCoupon(mapCart(data));
  }
  const { data: created } = await supabase.from("carts").insert({}).select("id").single();
  store.set(CART_COOKIE, created!.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return { id: created!.id, items: [], count: 0, subtotal: 0, couponCode: null, discount: 0, total: 0 };
}

export async function cartStateById(cartId: string): Promise<CartState> {
  const { data } = await supabase.from("carts").select(CART_SELECT).eq("id", cartId).maybeSingle();
  return withCoupon(mapCart(data));
}

export async function getCartCoupon(cartId: string): Promise<string | null> {
  const { data } = await supabase.from("carts").select("coupon_code").eq("id", cartId).maybeSingle();
  return data?.coupon_code ?? null;
}
