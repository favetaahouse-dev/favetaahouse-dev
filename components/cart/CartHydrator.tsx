import { getCart } from "@/lib/data/cart";
import { CartHydrateClient } from "./CartHydrateClient";

/**
 * Reads the visitor's cart and pushes it into CartProvider.
 *
 * This is the one part of the storefront layout that genuinely varies per visitor, and
 * reading it needs cookies(). Kept in its own component so the layout can wrap just this
 * in <Suspense> — everything else (nav, header, footer, page body) stays in the
 * prerendered shell that Vercel serves from the CDN.
 */
export async function CartHydrator() {
  const cart = await getCart();
  return <CartHydrateClient cart={cart} />;
}
