"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getOrCreateCart, cartStateById, getCart, type CartState, type CartLine } from "@/lib/data/cart";
import { getVariantOptions } from "@/lib/content";
import { MAX_MTO_QTY } from "@/lib/measurements";
import { MAX_LINE_NOTE, madeToOrderSizes } from "@/lib/variant-options";
import { sendMetaAddToCart } from "@/lib/meta/server-events";
import { addToCartPayload } from "@/lib/meta/events";

/** Meta dedup key + originating URL, supplied by the browser so both halves share an event_id. */
export type AddToCartMeta = { eventId: string; eventSourceUrl?: string; fbc?: string };

/** The shopper's note, as stored: trimmed, and null rather than "" so "no note" has one spelling. */
const cleanNote = (note: string | undefined): string | null => note?.trim() || null;

/**
 * Identity of a made-to-order line: same product, colour, size, length, tack-tack and note — the
 * same choices that make two ready-to-wear lines one line.
 *
 * Done here rather than by a unique constraint: the DB keeps a partial unique index for
 * READY-TO-WEAR lines only (see 20260926120000_line_notes.sql), keyed on the variant, and a
 * made-to-order line has none. A line carried over from the measurement form has no size, so it
 * can never match a new one and is never silently merged into it.
 */
function mtoKey(l: {
  productId: string;
  colorId: string | null;
  size: string | null;
  length: number | null;
  tackTack: boolean | null;
  notes: string | null;
}): string {
  return [l.productId, l.colorId ?? "", l.size ?? "", l.length ?? "", l.tackTack ? 1 : 0, l.notes ?? ""].join("|");
}

/**
 * Add or increment a line, without PostgREST's upsert.
 *
 * The ready-to-wear uniqueness key is now a PARTIAL index over coalesced expressions, and
 * PostgREST emits a bare `ON CONFLICT (cols)` that can never arbitrate one — the failure would
 * only appear when a duplicate was actually attempted. So the read-then-write is explicit and
 * the index stays as the race backstop rather than the mechanism.
 */
async function upsertLine(
  cartId: string,
  existing: CartLine | undefined,
  row: Record<string, unknown>,
  addQty: number,
  maxQty: number,
): Promise<void> {
  if (existing) {
    const next = Math.min(existing.quantity + addQty, maxQty);
    const { error } = await supabase.from("cart_items").update({ quantity: next }).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from("cart_items")
    .insert({ ...row, cart_id: cartId, quantity: Math.min(addQty, maxQty) } as never);
  if (error) throw new Error(error.message);
}

const rtwInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).optional(),
  /** Inches, from the house length list. */
  length: z.number().int().positive().optional(),
  tackTack: z.boolean().optional(),
  note: z.string().max(MAX_LINE_NOTE).optional(),
});
export type ReadyToWearInput = z.input<typeof rtwInputSchema>;

export async function addToCartAction(
  input: ReadyToWearInput,
  meta?: AddToCartMeta,
): Promise<{ ok: boolean; cart: CartState; error?: string }> {
  const parsed = rtwInputSchema.safeParse(input);
  const cart = await getOrCreateCart();
  if (!parsed.success) return { ok: false, cart: await cartStateById(cart.id!), error: "invalid" };
  const { variantId, quantity = 1, tackTack = false } = parsed.data;
  const { data: variant } = await supabase
    .from("variants")
    .select("available, stock, product_id, color_id")
    .eq("id", variantId)
    .maybeSingle();
  if (!variant || !variant.available || variant.stock < 1) {
    return { ok: false, cart: await cartStateById(cart.id!), error: "unavailable" };
  }
  // A line is a (variant, length, tack-tack, note) choice — the same size in two lengths, or with
  // two different notes, is two lines. The DB's partial unique index says the same thing.
  const len = parsed.data.length ?? null;
  const notes = cleanNote(parsed.data.note);
  const isThisLine = (i: CartLine) =>
    i.fulfillment === "RTW" &&
    i.variantId === variantId &&
    i.length === len &&
    i.tackTack === tackTack &&
    i.notes === notes;
  await upsertLine(
    cart.id!,
    cart.items.find(isThisLine),
    {
      variant_id: variantId,
      product_id: variant.product_id,
      color_id: variant.color_id,
      fulfillment: "RTW",
      length: len,
      tack_tack: tackTack,
      notes,
    },
    quantity,
    variant.stock,
  );
  const next = await cartStateById(cart.id!);

  // Meta AddToCart, server side. Costs no extra queries: the line we just wrote is already in
  // `next`, carrying handle, title and price. Awaited rather than floated because a floating
  // promise is not guaranteed to run on Vercel — the function can be frozen the moment this
  // action returns. It can never throw (see lib/meta/capi.ts).
  if (meta?.eventId) {
    const line = next.items.find(isThisLine);
    if (line) await reportAdd(line, quantity, meta);
  }

  return { ok: true, cart: next };
}

const mtoInputSchema = z.object({
  /** The handle, not an id: the same query that resolves it also enforces status = 'active'. */
  handle: z.string().trim().min(1).max(120),
  colorId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_MTO_QTY).optional(),
  size: z.string().trim().min(1).max(40),
  /** Inches, from the house length list. */
  length: z.number().int().positive().optional(),
  tackTack: z.boolean().optional(),
  note: z.string().max(MAX_LINE_NOTE).optional(),
});
export type MadeToOrderInput = z.input<typeof mtoInputSchema>;

/**
 * Add a made-to-order line: a colour, a size and a length in inches, the same chips a
 * ready-to-wear piece is bought with — only never sold out, because it is cut after the sale.
 *
 * A sibling action rather than more positional parameters on addToCartAction, which was already
 * at five — the ready-to-wear path is the one that must not break.
 *
 * Everything the browser sent is re-derived or re-checked here. Server actions are public
 * endpoints, so the product's mode, its price, the colour, and the size and length lists are read
 * from the database and the CMS, never taken from the payload — the same reasoning
 * assertOptionsAllowed was written under.
 */
export async function addMadeToOrderAction(
  input: MadeToOrderInput,
  meta?: AddToCartMeta,
): Promise<{ ok: boolean; cart: CartState; error?: string }> {
  const parsed = mtoInputSchema.safeParse(input);
  const cart = await getOrCreateCart();
  const fail = async (error: string) => ({ ok: false, cart: await cartStateById(cart.id!), error });
  if (!parsed.success) return fail("invalid");
  const data = parsed.data;

  const { data: product } = await supabase
    .from("products")
    .select("id, fulfillment, mto_price, variants(size)")
    .eq("handle", data.handle)
    .eq("status", "active")
    .maybeSingle();
  if (!product || product.fulfillment === "READY_TO_WEAR" || product.mto_price == null) {
    return fail("unavailable");
  }

  const { data: color } = await supabase
    .from("product_colors")
    .select("id")
    .eq("id", data.colorId)
    .eq("product_id", product.id)
    .maybeSingle();
  if (!color) return fail("color");

  const options = await getVariantOptions();
  const sizes = madeToOrderSizes((product.variants ?? []).map((v) => v.size), options.sizes);
  if (!sizes.includes(data.size)) return fail("size");
  // Required whenever the house offers lengths at all, and only ever one of them.
  const length = options.lengths.length ? (data.length ?? null) : null;
  if (options.lengths.length && (length == null || !options.lengths.includes(length))) {
    return fail("length");
  }

  const tackTack = !!data.tackTack;
  const notes = cleanNote(data.note);
  const qty = data.quantity ?? 1;
  const key = mtoKey({ productId: product.id, colorId: color.id, size: data.size, length, tackTack, notes });
  const existing = cart.items.find((i) => i.fulfillment === "MTO" && mtoKey(i) === key);

  try {
    await upsertLine(
      cart.id!,
      existing,
      {
        variant_id: null,
        product_id: product.id,
        color_id: color.id,
        fulfillment: "MTO",
        size: data.size,
        length,
        tack_tack: tackTack,
        notes,
      },
      qty,
      MAX_MTO_QTY,
    );
  } catch {
    return fail("error");
  }

  const next = await cartStateById(cart.id!);
  if (meta?.eventId) {
    // Located by the line key, not by variantId — every made-to-order line has a null
    // variantId, so matching on it would report the wrong line, or none.
    const line = next.items.find((i) => i.fulfillment === "MTO" && mtoKey(i) === key);
    if (line) await reportAdd(line, qty, meta);
  }
  return { ok: true, cart: next };
}

/** The Conversions API half of an add-to-cart. Shared so the two paths report identically. */
async function reportAdd(line: CartLine, added: number, meta: AddToCartMeta): Promise<void> {
  await sendMetaAddToCart({
    eventId: meta.eventId,
    eventSourceUrl: meta.eventSourceUrl,
    clientFbc: meta.fbc,
    payload: addToCartPayload({
      handle: line.handle,
      title: line.title,
      priceFils: line.price,
      // The incremental add, not the line's new total — Meta's AddToCart is about what was
      // just added, and the stored quantity is cumulative for an existing line.
      quantity: added,
    }),
  });
}

export async function updateCartItemAction(itemId: string, quantity: number): Promise<CartState> {
  const { data: item } = await supabase
    .from("cart_items")
    .select("id, cart_id, fulfillment, variant:variants(stock)")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return getCart();
  if (quantity <= 0) {
    await supabase.from("cart_items").delete().eq("id", itemId);
  } else {
    // Made-to-order has no stock to cap against — without its own cap the `?? quantity`
    // fallback below would leave those lines unbounded.
    const cap =
      item.fulfillment === "MTO"
        ? MAX_MTO_QTY
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((item.variant as any)?.stock ?? quantity);
    await supabase.from("cart_items").update({ quantity: Math.min(quantity, cap) }).eq("id", itemId);
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
