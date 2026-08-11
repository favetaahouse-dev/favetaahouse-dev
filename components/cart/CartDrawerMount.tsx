"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useCart } from "@/components/providers/cart-context";

const CartDrawer = dynamic(() => import("./CartDrawer").then((m) => m.CartDrawer));

/**
 * Keeps the cart drawer out of the initial bundle without costing it its slide-in.
 *
 * The drawer was mounted into every page with `open` only toggling CSS, dragging the price
 * formatter and currency context along with it. Here it loads once the page has gone idle,
 * so by the time anyone adds to cart the element already exists and can animate open —
 * and if someone gets there first, the open itself mounts it.
 */
export function CartDrawerMount() {
  const { open } = useCart();
  // Latches true and never goes back — mounting is one-way, so that closing the drawer
  // leaves an element behind to animate out.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void) => number;
    };
    if (w.requestIdleCallback) {
      w.requestIdleCallback(() => setMounted(true));
      return;
    }
    const id = setTimeout(() => setMounted(true), 1500);
    return () => clearTimeout(id);
  }, []);

  // Someone who reaches the cart before the page goes idle has to get the drawer in this
  // same commit, so this is a render-phase adjustment rather than an effect: an effect
  // would paint one frame with no drawer and swallow the slide-in.
  if (open && !mounted) setMounted(true);

  return mounted ? <CartDrawer /> : null;
}
