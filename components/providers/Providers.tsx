"use client";

import { CurrencyProvider } from "./currency-context";
import { CartProvider } from "./cart-context";
import { WishlistProvider } from "./wishlist-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CurrencyProvider>
      <WishlistProvider>
        <CartProvider>{children}</CartProvider>
      </WishlistProvider>
    </CurrencyProvider>
  );
}
