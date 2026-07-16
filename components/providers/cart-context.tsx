"use client";

import { createContext, useContext, useState, useTransition, useCallback } from "react";
import type { CartState, CartLine } from "@/lib/data/cart";
import { addToCartAction, updateCartItemAction, removeCartItemAction } from "@/lib/actions/cart";
import { applyCouponAction, removeCouponAction } from "@/lib/actions/coupon";

type CartCtx = {
  items: CartLine[];
  count: number;
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  open: boolean;
  pending: boolean;
  setOpen: (o: boolean) => void;
  add: (variantId: string, qty?: number) => Promise<boolean>;
  update: (itemId: string, qty: number) => void;
  remove: (itemId: string) => void;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ initial, children }: { initial: CartState; children: React.ReactNode }) {
  const [state, setState] = useState<CartState>(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const add = useCallback(async (variantId: string, qty = 1) => {
    const res = await addToCartAction(variantId, qty);
    setState(res.cart);
    if (res.ok) setOpen(true);
    return res.ok;
  }, []);

  const update = useCallback((itemId: string, quantity: number) => {
    setState((s) => {
      const items = s.items
        .map((i) => (i.id === itemId ? { ...i, quantity: Math.max(0, quantity) } : i))
        .filter((i) => i.quantity > 0);
      return recompute(s, items);
    });
    startTransition(async () => setState(await updateCartItemAction(itemId, quantity)));
  }, []);

  const remove = useCallback((itemId: string) => {
    setState((s) => recompute(s, s.items.filter((i) => i.id !== itemId)));
    startTransition(async () => setState(await removeCartItemAction(itemId)));
  }, []);

  const applyCoupon = useCallback(async (code: string) => {
    const res = await applyCouponAction(code);
    setState(res.cart);
    return res.ok;
  }, []);

  const removeCoupon = useCallback(() => {
    startTransition(async () => setState(await removeCouponAction()));
  }, []);

  return (
    <Ctx.Provider
      value={{
        items: state.items,
        count: state.count,
        subtotal: state.subtotal,
        discount: state.discount,
        total: state.total,
        couponCode: state.couponCode,
        open,
        pending,
        setOpen,
        add,
        update,
        remove,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </Ctx.Provider>
  );
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
  };
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
