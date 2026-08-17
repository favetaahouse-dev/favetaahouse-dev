import "server-only";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { computeDiscount, type Coupon } from "@/lib/coupons";
import { getMadeToOrderSettings } from "@/lib/content";
import {
  MAX_MTO_QTY,
  asMeasurements,
  isUnit,
  type Measurements,
  type Unit,
} from "@/lib/measurements";

export const CART_COOKIE = "cartId";

/**
 * One line type for two kinds of purchase.
 *
 * A ready-to-wear line is a variant: a stocked (colour, size) row, optionally with a length and
 * tack-tack choice. A made-to-order line has no variant and no size — it is a product, a colour
 * and a set of measurements, cut after the sale. `fulfillment` is which one you are looking at,
 * and it decides which of the nullable halves is populated.
 *
 * `maxQty` rather than `maxStock`: for a made-to-order line "stock" is a lie — there is nothing
 * on a shelf — so the field says what it actually bounds. Ready-to-wear fills it from stock,
 * made-to-order from MAX_MTO_QTY.
 */
export type CartLine = {
  id: string;
  fulfillment: "RTW" | "MTO";
  productId: string;
  variantId: string | null;
  colorId: string | null;
  handle: string;
  title: string;
  color: string;
  size: string | null;
  length: number | null;
  tackTack: boolean | null;
  measurements: Measurements | null;
  measureUnit: Unit | null;
  notes: string | null;
  leadMin: number | null;
  leadMax: number | null;
  price: number;
  compareAt: number | null;
  image: string | null;
  quantity: number;
  maxQty: number;
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
  /** True when any line is made-to-order — drives the lead-time notice at checkout. */
  hasMadeToOrder: boolean;
};

/**
 * cart_items.product_id is NOT NULL for every line now, so the product comes off the line
 * directly rather than through the variant. That is what lets a made-to-order line — which has
 * no variant at all — still resolve a handle, a title and a photograph.
 */
const CART_SELECT =
  "id, coupon_code, items:cart_items(id, quantity, fulfillment, length, tack_tack, measurements, measure_unit, notes, " +
  "variant:variants(id, color, size, price, compare_at, stock, available, image_url), " +
  "color:product_colors(id, name, hex, image_url), " +
  "product:products(id, handle, title, fulfillment, mto_price, mto_compare_at, mto_lead_min, mto_lead_max, " +
  "images:product_images(url, position)))";

/**
 * Exported because three call sites used to spell this literal out by hand — the client
 * provider's initial state, removeCouponAction's no-cart branch and this file's own empty
 * return. Adding a field to CartState broke all three, which is the argument for one copy.
 */
export const EMPTY_CART: CartState = {
  id: null, items: [], count: 0, subtotal: 0, couponCode: null, discount: 0, total: 0,
  hasMadeToOrder: false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstImage(p: any): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [...(p?.images ?? [])].sort((a: any, b: any) => a.position - b.position)[0]?.url ?? null;
}

/**
 * Lines are priced LIVE from the product/variant rather than from a snapshot taken when they
 * were added. That is deliberate and unchanged from before made-to-order: it is what keeps the
 * total the shopper sees in agreement with create_order's own server-side recompute, instead of
 * letting the two disagree until the payment page.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLine(it: any): CartLine | null {
  const p = it.product;
  if (!p) return null;
  const mto = it.fulfillment === "MTO";

  if (mto) {
    const price = p.mto_price;
    return {
      id: it.id,
      fulfillment: "MTO",
      productId: p.id,
      variantId: null,
      colorId: it.color?.id ?? null,
      handle: p.handle,
      title: p.title,
      color: it.color?.name ?? "",
      size: null,
      length: null,
      tackTack: it.tack_tack,
      measurements: asMeasurements(it.measurements),
      measureUnit: isUnit(it.measure_unit) ? it.measure_unit : null,
      notes: it.notes ?? null,
      leadMin: p.mto_lead_min ?? null,
      leadMax: p.mto_lead_max ?? null,
      price: price ?? 0,
      compareAt: p.mto_compare_at ?? null,
      image: it.color?.image_url ?? firstImage(p),
      quantity: it.quantity,
      maxQty: MAX_MTO_QTY,
      // A product switched back to ready-to-wear only, or left without a made-to-order price,
      // can no longer honour this line. Surfacing it as unavailable is what lets the drawer say
      // so before checkout refuses it.
      available: p.fulfillment !== "READY_TO_WEAR" && price != null,
    };
  }

  const v = it.variant;
  if (!v) return null;
  return {
    id: it.id,
    fulfillment: "RTW",
    productId: p.id,
    variantId: v.id,
    colorId: it.color?.id ?? null,
    handle: p.handle,
    title: p.title,
    color: v.color,
    size: v.size,
    length: it.length,
    tackTack: it.tack_tack,
    measurements: null,
    measureUnit: null,
    notes: null,
    leadMin: null,
    leadMax: null,
    price: v.price,
    compareAt: v.compare_at,
    image: v.image_url ?? firstImage(p),
    quantity: it.quantity,
    maxQty: v.stock,
    available: v.available,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mapCart(cart: any): Promise<CartState> {
  if (!cart) return EMPTY_CART;
  const items: CartLine[] = (cart.items ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((it: any) => mapLine(it))
    .filter((l: CartLine | null): l is CartLine => l !== null)
    .sort((a: CartLine, b: CartLine) => a.id.localeCompare(b.id));

  // The house-wide lead time fills in for any product that leaves its own blank. Fetched once,
  // and only when there is a made-to-order line to fill in — it is a cached read, but an
  // all-ready-to-wear cart should not depend on the made-to-order section at all.
  const needsLead = items.some((i) => i.fulfillment === "MTO" && (i.leadMin == null || i.leadMax == null));
  if (needsLead) {
    const { leadMinDays, leadMaxDays } = await getMadeToOrderSettings();
    for (const i of items) {
      if (i.fulfillment !== "MTO") continue;
      i.leadMin ??= leadMinDays;
      i.leadMax ??= leadMaxDays;
    }
  }

  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  return {
    id: cart.id,
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    couponCode: cart.coupon_code ?? null,
    discount: 0,
    total: subtotal,
    hasMadeToOrder: items.some((i) => i.fulfillment === "MTO"),
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
  if (!id) return EMPTY_CART;
  const { data } = await supabase.from("carts").select(CART_SELECT).eq("id", id).maybeSingle();
  return withCoupon(await mapCart(data));
}

export async function getOrCreateCart(): Promise<CartState> {
  const store = await cookies();
  const id = store.get(CART_COOKIE)?.value;
  if (id) {
    const { data } = await supabase.from("carts").select(CART_SELECT).eq("id", id).maybeSingle();
    if (data) return withCoupon(await mapCart(data));
  }
  const { data: created } = await supabase.from("carts").insert({}).select("id").single();
  store.set(CART_COOKIE, created!.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return { ...EMPTY_CART, id: created!.id };
}

export async function cartStateById(cartId: string): Promise<CartState> {
  const { data } = await supabase.from("carts").select(CART_SELECT).eq("id", cartId).maybeSingle();
  return withCoupon(await mapCart(data));
}

export async function getCartCoupon(cartId: string): Promise<string | null> {
  const { data } = await supabase.from("carts").select("coupon_code").eq("id", cartId).maybeSingle();
  return data?.coupon_code ?? null;
}
