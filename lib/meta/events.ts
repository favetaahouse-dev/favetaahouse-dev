/**
 * The single payload builder for every Meta event — called by BOTH the browser pixel and the
 * server-side Conversions API.
 *
 * This module is the whole point of the integration's shape. Meta deduplicates a browser event
 * against a server event on `(event_name, event_id)`, but it only MERGES them if they describe
 * the same thing; if the two sides compute `value` or `content_ids` differently, Meta sees two
 * events that happen to share an id and the reporting quietly goes wrong. One builder, two
 * callers, no possible drift.
 *
 * Isomorphic — no `server-only`, no `"use client"`, no imports beyond config.
 *
 * TWO RULES THAT ARE EASY TO GET WRONG AND EXPENSIVE TO MISS:
 *   1. Every price entering here is integer FILS. Everything leaving here is major-unit QAR.
 *      Send fils by mistake and every revenue figure is 100x.
 *   2. `content_ids` is always `products.handle`. Not sku (null for anything created in the
 *      admin — there is no write path for it), not the variant uuid, not product_code (not
 *      unique). The owner has no Meta catalogue yet, so handle is what one must be built on.
 */
import { META_CURRENCY, toMajorUnits } from "./config";

/** One line of a cart or order, already resolved to a product handle. */
export type MetaLine = {
  /** products.handle — the content id. */
  handle: string;
  title: string;
  /** Unit price in integer fils. */
  priceFils: number;
  quantity: number;
  category?: string | null;
};

export type MetaContent = {
  id: string;
  quantity: number;
  item_price: number;
};

export type MetaPayload = {
  content_type?: "product";
  content_ids?: string[];
  content_name?: string;
  content_category?: string;
  contents?: MetaContent[];
  value?: number;
  currency?: string;
  num_items?: number;
  search_string?: string;
};

/**
 * Collapse lines to one entry per handle.
 *
 * A single product can occupy several cart lines — a line is a (variant, length, tack-tack)
 * choice, so the same abaya in two lengths is two rows (lib/actions/cart.ts). Meta's own QA
 * checks that `Σ(quantity × item_price) === value`, so the merged `item_price` has to be the
 * QUANTITY-WEIGHTED MEAN, not the first price seen — otherwise a product whose variants are
 * priced differently fails that check and the events get flagged.
 */
function mergeByHandle(lines: MetaLine[]): { contents: MetaContent[]; ids: string[]; valueFils: number; items: number } {
  const byHandle = new Map<string, { fils: number; qty: number }>();
  let valueFils = 0;
  let items = 0;

  for (const l of lines) {
    if (l.quantity <= 0) continue;
    valueFils += l.priceFils * l.quantity;
    items += l.quantity;
    // A line whose product handle could not be resolved (a deleted product — order_items.variant_id
    // is ON DELETE SET NULL) still counts toward value and num_items. It is simply not addressable
    // as a catalogue item. Dropping the whole event over it would lose real revenue.
    if (!l.handle) continue;
    const prev = byHandle.get(l.handle) ?? { fils: 0, qty: 0 };
    byHandle.set(l.handle, { fils: prev.fils + l.priceFils * l.quantity, qty: prev.qty + l.quantity });
  }

  const contents: MetaContent[] = [];
  const ids: string[] = [];
  for (const [handle, { fils, qty }] of byHandle) {
    ids.push(handle);
    contents.push({ id: handle, quantity: qty, item_price: toMajorUnits(Math.round(fils / qty)) });
  }
  return { contents, ids, valueFils, items };
}

/** A single product page view. `priceFils` should be the SELECTED variant's price. */
export function viewContentPayload(p: {
  handle: string;
  title: string;
  priceFils: number;
  category?: string | null;
}): MetaPayload {
  return {
    content_type: "product",
    content_ids: [p.handle],
    content_name: p.title,
    ...(p.category ? { content_category: p.category } : {}),
    contents: [{ id: p.handle, quantity: 1, item_price: toMajorUnits(p.priceFils) }],
    value: toMajorUnits(p.priceFils),
    currency: META_CURRENCY,
  };
}

/** What was just added — not the whole cart. Meta's AddToCart is about the incremental item. */
export function addToCartPayload(line: MetaLine): MetaPayload {
  const value = line.priceFils * line.quantity;
  return {
    content_type: "product",
    content_ids: [line.handle],
    content_name: line.title,
    ...(line.category ? { content_category: line.category } : {}),
    contents: [{ id: line.handle, quantity: line.quantity, item_price: toMajorUnits(line.priceFils) }],
    value: toMajorUnits(value),
    currency: META_CURRENCY,
    num_items: line.quantity,
  };
}

/** The whole cart at the moment checkout begins. */
export function initiateCheckoutPayload(lines: MetaLine[]): MetaPayload {
  const { contents, ids, valueFils, items } = mergeByHandle(lines);
  return {
    content_type: "product",
    content_ids: ids,
    contents,
    value: toMajorUnits(valueFils),
    currency: META_CURRENCY,
    num_items: items,
  };
}

/** Same shape as InitiateCheckout — a payment session was successfully created for this cart. */
export const addPaymentInfoPayload = initiateCheckoutPayload;

/**
 * The paid order. `totalFils` is `orders.total`, which already includes shipping and tax and is
 * net of discount — that is what the customer actually paid, and what ROAS must be measured on.
 * The per-line `contents` therefore will NOT sum to `value`; that is correct and expected for
 * Purchase, and is why `value` is passed in separately rather than derived from the lines.
 */
export function purchasePayload(order: { lines: MetaLine[]; totalFils: number }): MetaPayload {
  const { contents, ids, items } = mergeByHandle(order.lines);
  return {
    content_type: "product",
    content_ids: ids,
    contents,
    value: toMajorUnits(order.totalFils),
    currency: META_CURRENCY,
    num_items: items,
  };
}

export function searchPayload(query: string, resultHandles: string[] = []): MetaPayload {
  return {
    search_string: query,
    ...(resultHandles.length ? { content_type: "product" as const, content_ids: resultHandles } : {}),
  };
}

export function addToWishlistPayload(p: { handle: string; title?: string }): MetaPayload {
  // The wishlist is localStorage and stores handles only (components/providers/wishlist-context.tsx),
  // so there is genuinely no price to report. Sending value: 0 would be a lie that drags down
  // reported AOV — omit it instead.
  return {
    content_type: "product",
    content_ids: [p.handle],
    ...(p.title ? { content_name: p.title } : {}),
  };
}
