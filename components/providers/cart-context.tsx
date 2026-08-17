"use client";

import { createContext, useContext, useState, useTransition, useCallback, useRef, useMemo } from "react";
import type { CartState, CartLine } from "@/lib/data/cart";
import {
  addToCartAction,
  addMadeToOrderAction,
  updateCartItemAction,
  removeCartItemAction,
  type MadeToOrderInput,
} from "@/lib/actions/cart";
import { applyCouponAction, removeCouponAction } from "@/lib/actions/coupon";

type CartCtx = {
  items: CartLine[];
  count: number;
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  hasMadeToOrder: boolean;
  open: boolean;
  pending: boolean;
  setOpen: (o: boolean) => void;
  /**
   * Made-to-order lives beside `add` rather than inside it: the two carry genuinely different
   * payloads (a stocked variant vs. a measurement set) and folding them together would put the
   * ready-to-wear path — the one that already works — at risk for no gain.
   * Resolves to null on success, or the server's reason so the form can say which field failed.
   */
  addMto: (
    input: MadeToOrderInput,
    meta?: { eventId: string; eventSourceUrl?: string },
  ) => Promise<string | null>;
  add: (
    variantId: string,
    qty?: number,
    length?: number,
    tackTack?: boolean,
    /** Meta dedup key + page URL, so the server can send the matching Conversions API event. */
    meta?: { eventId: string; eventSourceUrl?: string },
  ) => Promise<boolean>;
  update: (itemId: string, qty: number) => void;
  remove: (itemId: string) => void;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  hydrate: (s: CartState) => void;
};

const Ctx = createContext<CartCtx | null>(null);

/**
 * Spelled out rather than imported from lib/data/cart, which exports the same constant: that
 * module is `server-only`, so this file may take TYPES from it but not values. The type
 * annotation is what keeps the two in step — adding a field to CartState fails this line.
 */
const EMPTY: CartState = {
  id: null, items: [], count: 0, subtotal: 0, couponCode: null, discount: 0, total: 0,
  hasMadeToOrder: false,
};

/**
 * Starts empty and is filled in by <CartHydrator>, which streams in from its own Suspense
 * boundary. Reading the cart needs cookies(), and doing that in the layout would opt every
 * page out of the prerendered shell — so the shell renders an empty cart and the real one
 * arrives a moment later.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Once the shopper has touched the cart their state is newer than the server's snapshot,
  // so a late-arriving hydrate must not overwrite it.
  const touched = useRef(false);

  const hydrate = useCallback((s: CartState) => {
    if (!touched.current) setState(s);
  }, []);

  const add = useCallback(
    async (
      variantId: string,
      qty = 1,
      length?: number,
      tackTack?: boolean,
      meta?: { eventId: string; eventSourceUrl?: string },
    ) => {
      touched.current = true;
      const res = await addToCartAction(variantId, qty, length, tackTack, meta);
      setState(res.cart);
      if (res.ok) setOpen(true);
      return res.ok;
    },
    [],
  );

  const addMto = useCallback<CartCtx["addMto"]>(async (input, meta) => {
    touched.current = true;
    const res = await addMadeToOrderAction(input, meta);
    setState(res.cart);
    if (res.ok) setOpen(true);
    return res.ok ? null : (res.error ?? "error");
  }, []);

  const update = useCallback((itemId: string, quantity: number) => {
    touched.current = true;
    setState((s) => {
      const items = s.items
        .map((i) => (i.id === itemId ? { ...i, quantity: Math.max(0, quantity) } : i))
        .filter((i) => i.quantity > 0);
      return recompute(s, items);
    });
    startTransition(async () => setState(await updateCartItemAction(itemId, quantity)));
  }, []);

  const remove = useCallback((itemId: string) => {
    touched.current = true;
    setState((s) => recompute(s, s.items.filter((i) => i.id !== itemId)));
    startTransition(async () => setState(await removeCartItemAction(itemId)));
  }, []);

  const applyCoupon = useCallback(async (code: string) => {
    touched.current = true;
    const res = await applyCouponAction(code);
    setState(res.cart);
    return res.ok;
  }, []);

  const removeCoupon = useCallback(() => {
    touched.current = true;
    startTransition(async () => setState(await removeCouponAction()));
  }, []);

  // Memoised: every <Price> and cart button consumes this, so an unstable object literal
  // re-renders all of them on any unrelated render.
  const value = useMemo<CartCtx>(
    () => ({
      items: state.items,
      count: state.count,
      subtotal: state.subtotal,
      discount: state.discount,
      total: state.total,
      couponCode: state.couponCode,
      hasMadeToOrder: state.hasMadeToOrder,
      open,
      pending,
      setOpen,
      add,
      addMto,
      update,
      remove,
      applyCoupon,
      removeCoupon,
      hydrate,
    }),
    [state, open, pending, add, addMto, update, remove, applyCoupon, removeCoupon, hydrate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function recompute(s: CartState, items: CartLine[]): CartState {
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const discount = Math.min(s.discount, subtotal);
  return {
    ...s,
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    discount,
    total: Math.max(subtotal - discount, 0),
    // Derived, not carried over from `s`: removing the last made-to-order line optimistically
    // has to drop the checkout lead-time notice with it, not a round trip later.
    hasMadeToOrder: items.some((i) => i.fulfillment === "MTO"),
  };
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
