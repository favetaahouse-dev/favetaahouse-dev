"use client";

import { useEffect } from "react";
import { useCart } from "@/components/providers/cart-context";
import type { CartState } from "@/lib/data/cart";

/** Renders nothing; exists only to hand the streamed server cart to the client provider. */
export function CartHydrateClient({ cart }: { cart: CartState }) {
  const { hydrate } = useCart();
  useEffect(() => {
    hydrate(cart);
  }, [cart, hydrate]);
  return null;
}
