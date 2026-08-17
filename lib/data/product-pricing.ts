import "server-only";
import { supabase } from "@/lib/supabase";

/**
 * Refresh the denormalised products.price_min / price_max.
 *
 * WHY IT LIVES HERE rather than in lib/actions/products.ts, which is where it grew up: that file
 * carries "use server", so every export in it is a publicly-callable endpoint. Exporting this to
 * share it with the import route would publish an unauthenticated "recompute any product's prices"
 * action to the internet. A plain server module has no such property, and route handlers can
 * import it freely.
 *
 * WHY IT IS NOW ONE RPC. There are two price sources since made-to-order landed, so the range is
 * a three-way rule: ready-to-wear takes min/max over the variant rows, made-to-order is the single
 * mto_price, and BOTH is the union. That rule also has to run inside generate_variants, and
 * writing it twice — once in plpgsql, once here — is how the two drift.
 *
 * Moving it into SQL also retires the two-ordered-LIMIT-1-queries shape this used to have. That
 * existed only to dodge PostgREST capping a result set at 1000 rows and truncating it SILENTLY,
 * which made min/max over an arbitrary prefix as soon as a product outgrew the cap. An aggregate
 * inside the database is exact at any size and cannot hit that cap at all.
 *
 * Throws rather than swallowing: a stale price_min is a wrong price in front of a customer, so the
 * caller needs the chance to say so. Every caller runs this LAST, after its own write has landed,
 * so a throw here means "the write succeeded but the cached range may lag" — which is exactly what
 * the admin should be told.
 */
export async function recomputePrices(productId: string): Promise<void> {
  const { error } = await supabase.rpc("recompute_product_prices", { p_product_id: productId });
  if (error) throw new Error(error.message);
}
