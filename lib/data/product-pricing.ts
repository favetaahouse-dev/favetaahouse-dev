import "server-only";
import { supabase } from "@/lib/supabase";

/**
 * Refresh the denormalised products.price_min / price_max from the product's variant rows.
 *
 * WHY IT LIVES HERE rather than in lib/actions/products.ts, which is where it grew up: that file
 * carries "use server", so every export in it is a publicly-callable endpoint. Exporting this to
 * share it with the import route would publish an unauthenticated "recompute any product's prices"
 * action to the internet. A plain server module has no such property, and route handlers can
 * import it freely.
 *
 * WHY TWO QUERIES rather than one `select("price")` and Math.min/max over the result: PostgREST
 * caps a result set (1000 rows by default) and truncates it SILENTLY — no error, no flag. The old
 * version therefore computed min/max over an arbitrary 1000-row prefix as soon as a product grew
 * past the cap, and wrote a confidently wrong price onto every collection card. Ordering in the
 * database and taking a single row is exact at any size and rides the existing
 * variants_product_idx on (product_id).
 *
 * Throws rather than swallowing: a stale price_min is a wrong price in front of a customer, so the
 * caller needs the chance to say so. Every caller runs this LAST, after its own write has landed,
 * so a throw here means "the write succeeded but the cached range may lag" — which is exactly what
 * the admin should be told.
 */
export async function recomputePrices(productId: string): Promise<{ min: number; max: number }> {
  const [lo, hi] = await Promise.all([
    supabase
      .from("variants")
      .select("price")
      .eq("product_id", productId)
      .order("price", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("variants")
      .select("price")
      .eq("product_id", productId)
      .order("price", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (lo.error) throw new Error(lo.error.message);
  if (hi.error) throw new Error(hi.error.message);

  // No variants left is a real state (the last colour was just deleted) — zero the range rather
  // than leaving the price of a product that no longer has one.
  const min = lo.data?.price ?? 0;
  const max = hi.data?.price ?? 0;

  const { error } = await supabase
    .from("products")
    .update({ price_min: min, price_max: max })
    .eq("id", productId);
  if (error) throw new Error(error.message);

  return { min, max };
}
