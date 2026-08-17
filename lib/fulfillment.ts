/**
 * How a product is made: off the rail, cut to measure, or both.
 *
 * Its own module, with no imports, for two reasons that both bite otherwise. lib/actions/products.ts
 * carries "use server", where every export must be an async function — a plain predicate declared
 * there fails the build, not the type check. And lib/data/catalog.ts pulls in the Supabase client,
 * so a Client Component reading the type from there would drag the whole client into the browser
 * bundle.
 */

export const FULFILLMENT_MODES = ["READY_TO_WEAR", "MADE_TO_ORDER", "BOTH"] as const;
export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number];

/**
 * Whether a mode offers each way of buying. Both are written as "not the other one" rather than
 * as a list, so BOTH cannot be forgotten from one of them — which is exactly the bug an
 * `=== "MADE_TO_ORDER"` check scattered across the codebase would eventually produce.
 *
 * Neither says anything about PRICE. A product set to made-to-order without an mto_price cannot
 * actually be sold that way; that combined check is `offersMto` on FullProduct, derived once in
 * lib/data/catalog.ts.
 */
export const offersMadeToOrder = (m: string) => m !== "READY_TO_WEAR";
export const offersReadyToWear = (m: string) => m !== "MADE_TO_ORDER";
