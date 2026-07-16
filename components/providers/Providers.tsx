"use client";

import { CurrencyProvider } from "./currency-context";
import { CartProvider } from "./cart-context";
import { WishlistProvider } from "./wishlist-context";
import type { CartState } from "@/lib/data/cart";

export function Providers({
  initialCart,
  children,
}: {
  initialCart: CartState;
  children: React.ReactNode;
}) {
  return (
    <CurrencyProvider>
      <WishlistProvider>
        <CartProvider initial={initialCart}>{children}</CartProvider>
      </WishlistProvider>
    </CurrencyProvider>
  );
}
