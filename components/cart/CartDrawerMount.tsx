"use client";

import { useEffect, useRef, useState } from "react";
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
  const [idle, setIdle] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void) => number;
    };
    if (w.requestIdleCallback) {
      w.requestIdleCallback(() => setIdle(true));
      return;
    }
    const id = setTimeout(() => setIdle(true), 1500);
    return () => clearTimeout(id);
  }, []);

  if (open || idle) mounted.current = true;
  return mounted.current ? <CartDrawer /> : null;
}
