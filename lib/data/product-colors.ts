import "server-only";
import { supabase } from "@/lib/supabase";
import { MAX_COLORS } from "@/lib/variant-options";

/**
 * The colour list a product offers, and the name → id map every variant write needs.
 *
 * WHY IT LIVES HERE rather than in lib/actions/products.ts: that file carries "use server", so
 * every export in it is a publicly-callable endpoint, and the bulk import route needs to call
 * this too. Exporting it from there would publish an unauthenticated "rewrite any product's
 * colours" action to the internet. Same reasoning as lib/data/product-pricing.ts, which sits
 * here for exactly this reason.
 *
 * NOT a "use cache" module despite the directory: these are read immediately before a write
 * that depends on them, so a cached answer would be the wrong one.
 */

export type ColorInput = {
  name: string;
  nameAr?: string | null;
  hex?: string | null;
  imageUrl?: string | null;
};

/** name → id for one product's colours. */
export async function productColorMap(productId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("product_colors")
    .select("id, name")
    .eq("product_id", productId)
    .limit(MAX_COLORS + 1);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length > MAX_COLORS) {
    throw new Error(`This product has more than ${MAX_COLORS} colours — remove some first.`);
  }
  return new Map(rows.map((r) => [r.name as string, r.id as string]));
}

/**
 * Create or update colours by (product_id, name), and hand back the refreshed name → id map.
 *
 * Deliberately additive: it never deletes a colour the caller omitted. Deleting is its own
 * operation because a colour with variants or with live cart lines cannot just disappear —
 * see deleteProductColor in lib/actions/products.ts.
 */
export async function upsertProductColors(
  productId: string,
  colors: ColorInput[],
): Promise<Map<string, string>> {
  const clean: Required<ColorInput>[] = [];
  const seen = new Set<string>();
  for (const c of colors) {
    const name = (c.name ?? "").trim();
    // A blank or repeated name is dropped rather than rejected: the admin's colour rows start
    // life empty, and the import route is fed whatever another store exported.
    if (!name || seen.has(name)) continue;
    seen.add(name);
    clean.push({
      name,
      nameAr: c.nameAr?.trim() || null,
      hex: c.hex?.trim() || null,
      imageUrl: c.imageUrl?.trim() || null,
    });
  }
  if (clean.length > MAX_COLORS) {
    throw new Error(`A product can have at most ${MAX_COLORS} colours.`);
  }
  if (clean.length) {
    const { error } = await supabase.from("product_colors").upsert(
      clean.map((c, i) => ({
        product_id: productId,
        name: c.name,
        name_ar: c.nameAr,
        hex: c.hex,
        image_url: c.imageUrl,
        position: i,
      })),
      { onConflict: "product_id,name" },
    );
    if (error) throw new Error(error.message);
  }
  return productColorMap(productId);
}

/**
 * The colours implied by a set of variant rows, in first-seen order.
 *
 * The bulk import and the legacy seed both describe a product as a flat list of colour+size
 * rows, with no colour list of their own. This is what turns that back into one.
 */
export function colorsFromVariants(
  variants: { color: string; colorHex?: string | null }[],
): ColorInput[] {
  const out: ColorInput[] = [];
  const seen = new Set<string>();
  for (const v of variants) {
    const name = (v.color ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, hex: v.colorHex ?? null });
  }
  return out;
}
