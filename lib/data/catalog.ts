import { cacheLife, cacheTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { FulfillmentMode } from "@/lib/fulfillment";

export type ProductCardDTO = {
  handle: string;
  title: string;
  category: string;
  onSale: boolean;
  priceMin: number;
  priceMax: number;
  compareAtMax: number | null;
  image: string | null;
  hoverImage: string | null;
  swatches: { color: string; hex: string | null }[];
  inStock: boolean;
  fulfillment: FulfillmentMode;
};

// PostgREST select for card rows (images/colours ordered by position via query below).
// Shared with lib/data/collections.ts so the two listing queries can't drift apart.
//
// Colours come from product_colors rather than from the variant grid: a made-to-order product
// has colours and no variants at all, so reading swatches off variants would leave the majority
// of the catalogue with a blank swatch row.
//
// Every caller casts the result `as unknown as CardRow[]` rather than `as CardRow[]`. That is
// not laziness: supabase-js infers a row type by PARSING this string in the type system, and
// that parser is depth-limited. Three embeds plus the made-to-order columns crosses the limit,
// at which point it yields GenericStringError and the honest cast is the one through unknown.
// CardRow below is the hand-maintained contract — keep the two in step by hand, as
// getProductByHandle already does for the same reason.
export const CARD =
  "handle,title,title_ar,category,on_sale,price_min,price_max,fulfillment,mto_price,mto_compare_at," +
  "images:product_images(url,position),colors:product_colors(name,hex,position)," +
  "variants(price,compare_at,available)";

/**
 * A card renders only images[0] (main) and images[1] (hover), so ask the database for
 * exactly those two rather than every image row of every product — on the full catalogue
 * that is 195 rows instead of 419, a third off the response.
 *
 * The ordering is not decorative: without it PostgREST would pick an arbitrary two.
 */
export function cardImages<T>(query: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (query as any)
    .order("position", { referencedTable: "product_images", ascending: true })
    .limit(2, { referencedTable: "product_images" });
}

type CardRow = {
  handle: string;
  title: string;
  title_ar: string | null;
  category: string;
  on_sale: boolean;
  price_min: number;
  price_max: number;
  fulfillment: FulfillmentMode;
  mto_price: number | null;
  mto_compare_at: number | null;
  images: { url: string; position: number }[];
  colors: { name: string; hex: string | null; position: number }[];
  variants: { price: number; compare_at: number | null; available: boolean }[];
};

export function toCard(p: CardRow, locale: string): ProductCardDTO {
  const images = [...(p.images ?? [])].sort((a, b) => a.position - b.position);
  const colors = [...(p.colors ?? [])].sort((a, b) => a.position - b.position);
  const variants = p.variants ?? [];
  let compareAtMax: number | null = null;
  for (const v of variants) {
    if (v.compare_at && v.compare_at > v.price) compareAtMax = Math.max(compareAtMax ?? 0, v.compare_at);
  }
  const offersMto = p.fulfillment !== "READY_TO_WEAR" && p.mto_price != null;
  if (offersMto && p.mto_compare_at && p.mto_compare_at > p.mto_price!) {
    compareAtMax = Math.max(compareAtMax ?? 0, p.mto_compare_at);
  }
  return {
    handle: p.handle,
    // `||` (not `??`) so a blank Arabic title also falls back to English.
    title: locale === "ar" ? p.title_ar || p.title : p.title,
    category: p.category,
    onSale: p.on_sale,
    priceMin: p.price_min,
    priceMax: p.price_max,
    compareAtMax,
    image: images[0]?.url ?? null,
    hoverImage: images[1]?.url ?? null,
    swatches: colors.map((c) => ({ color: c.name, hex: c.hex })),
    // A made-to-order piece is cut after the sale, so it is never out of stock. Without this
    // clause every made-to-order card would render dimmed under a "Sold out" badge, because the
    // only signal here used to be whether some variant row was available — and it has none.
    inStock: offersMto || variants.some((v) => v.available),
    fulfillment: p.fulfillment,
  };
}

export async function getFeaturedProducts(take = 16, locale: string): Promise<ProductCardDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  // Homepage "Explore the Creation" grid = products flagged Featured in the admin.
  const { data } = await cardImages(
    supabase
      .from("products")
      .select(CARD)
      .eq("status", "active")
      .eq("featured", true)
      .order("created_at", { ascending: false })
      .limit(take),
  );
  const featured = ((data ?? []) as unknown as CardRow[]).map((r) => toCard(r, locale));
  // Never leave the homepage empty — fall back to the newest active products.
  return featured.length > 0 ? featured : getNewestProducts(take, locale);
}

export type CategoryGroup = { category: string; products: ProductCardDTO[] };

/**
 * The homepage's tabbed grid: the newest active products, bucketed by category.
 *
 * One query, grouped in memory, rather than one query per tab. The alternative — a
 * round trip per category — would multiply the database calls by however many
 * categories the catalogue happens to have, for a section that shows a handful of
 * each; and because every tab's products arrive together, switching tabs is instant
 * with no second fetch and no loading state.
 *
 * `take` is the pool size, not the per-tab count: the caller slices each bucket. A
 * category the pool never reaches simply gets no tab, which is the right outcome —
 * an empty tab is worse than an absent one.
 */
export async function getProductsByCategory(take = 60, locale: string): Promise<CategoryGroup[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const { data } = await cardImages(
    supabase
      .from("products")
      .select(CARD)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(take),
  );

  // Map, not an object literal: insertion order is the tab order, and it follows
  // created_at, so the category with the newest arrival leads.
  const groups = new Map<string, ProductCardDTO[]>();
  for (const row of (data ?? []) as unknown as CardRow[]) {
    const card = toCard(row, locale);
    if (!card.category) continue;
    const bucket = groups.get(card.category);
    if (bucket) bucket.push(card);
    else groups.set(card.category, [card]);
  }
  return [...groups.entries()].map(([category, products]) => ({ category, products }));
}

export async function getNewestProducts(take = 8, locale: string): Promise<ProductCardDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const { data } = await cardImages(
    supabase.from("products").select(CARD).eq("status", "active").order("created_at", { ascending: false }).limit(take),
  );
  return ((data ?? []) as unknown as CardRow[]).map((r) => toCard(r, locale));
}

export type FullProduct = {
  id: string;
  handle: string;
  title: string;
  category: string;
  productCode: string | null;
  description: string | null;
  materials: string | null;
  modelSize: string | null;
  details: string | null;
  packaging: string | null;
  priceMin: number;
  priceMax: number;
  images: { id: string; url: string; alt: string | null; position: number }[];
  /** Canonical colour list. Both modes read it; variants merely reference it. */
  colors: { id: string; name: string; hex: string | null; imageUrl: string | null }[];
  variants: {
    id: string;
    /**
     * The colour's id, not its name. `color` below is a denormalised English snapshot, while
     * colors[].name is localised — so on /ar matching a variant to a swatch by name finds
     * nothing. Everything downstream keys on this.
     */
    colorId: string;
    color: string; colorHex: string | null; size: string; sku: string | null;
    price: number; compareAt: number | null; stock: number; available: boolean; imageUrl: string | null; position: number;
  }[];
  fulfillment: FulfillmentMode;
  mtoPrice: number | null;
  mtoCompareAt: number | null;
  /** Null here means "use the house default" — resolved by the caller from the CMS. */
  mtoLeadMin: number | null;
  mtoLeadMax: number | null;
  /** Which measurement fields apply. Empty = all of them. */
  mtoFields: string[];
  /**
   * Derived ONCE, here, so no component re-derives it and gets the null-price case wrong.
   * A product set to made-to-order but never given a price cannot be sold that way, and must
   * read as not offering it rather than as offering it for nothing.
   */
  offersMto: boolean;
  offersRtw: boolean;
};

/**
 * Every product page asks for this twice — once in generateMetadata and once in the page
 * body — and it is the heaviest single-product query we run, so it is cached rather than
 * merely deduped. Admin product saves expire the "products" tag.
 */
export async function getProductByHandle(handle: string, locale: string): Promise<FullProduct | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const { data } = await supabase
    .from("products")
    .select(
      "id,handle,title,title_ar,category,product_code,description,description_ar,materials,materials_ar,model_size,details,details_ar,packaging,price_min,price_max," +
        "fulfillment,mto_price,mto_compare_at,mto_lead_min,mto_lead_max,mto_fields," +
        "images:product_images(id,url,alt,position),colors:product_colors(id,name,name_ar,hex,image_url,position)," +
        "variants(id,color_id,color,color_hex,size,sku,price,compare_at,stock,available,image_url,position)",
    )
    .eq("handle", handle)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  const p = data as unknown as Record<string, unknown> & {
    images: { id: string; url: string; alt: string | null; position: number }[];
    colors: { id: string; name: string; name_ar: string | null; hex: string | null; image_url: string | null; position: number }[];
    variants: { id: string; color_id: string; color: string; color_hex: string | null; size: string; sku: string | null; price: number; compare_at: number | null; stock: number; available: boolean; image_url: string | null; position: number }[];
  };
  const ar = locale === "ar";
  // `||` (not `??`) so a blank Arabic field falls back to English.
  const pick = (base: unknown, arabic: unknown): string | null =>
    (ar ? (arabic as string) || (base as string) : (base as string)) ?? null;
  return {
    id: p.id as string,
    handle: p.handle as string,
    title: pick(p.title, p.title_ar) as string,
    category: p.category as string,
    productCode: (p.product_code as string) ?? null,
    description: pick(p.description, p.description_ar),
    materials: pick(p.materials, p.materials_ar),
    modelSize: (p.model_size as string) ?? null,
    details: pick(p.details, p.details_ar),
    packaging: (p.packaging as string) ?? null,
    priceMin: p.price_min as number,
    priceMax: p.price_max as number,
    images: [...p.images].sort((a, b) => a.position - b.position),
    colors: [...(p.colors ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        // Same `||` fallback as every other bilingual field: a blank Arabic name shows English.
        name: ar ? c.name_ar || c.name : c.name,
        hex: c.hex,
        imageUrl: c.image_url,
      })),
    fulfillment: (p.fulfillment as FulfillmentMode) ?? "READY_TO_WEAR",
    mtoPrice: (p.mto_price as number) ?? null,
    mtoCompareAt: (p.mto_compare_at as number) ?? null,
    mtoLeadMin: (p.mto_lead_min as number) ?? null,
    mtoLeadMax: (p.mto_lead_max as number) ?? null,
    mtoFields: (p.mto_fields as string[]) ?? [],
    offersMto: p.fulfillment !== "READY_TO_WEAR" && p.mto_price != null,
    offersRtw: p.fulfillment !== "MADE_TO_ORDER",
    variants: [...p.variants]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        id: v.id, colorId: v.color_id, color: v.color, colorHex: v.color_hex, size: v.size, sku: v.sku,
        price: v.price, compareAt: v.compare_at, stock: v.stock, available: v.available, imageUrl: v.image_url, position: v.position,
      })),
  };
}

export async function getAllProductHandles(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const { data } = await supabase.from("products").select("handle").eq("status", "active");
  return (data ?? []).map((r) => r.handle as string);
}

export async function getRelatedProducts(productId: string, category: string, take = 4, locale: string): Promise<ProductCardDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const { data } = await cardImages(
    supabase
      .from("products")
      .select(CARD)
      .eq("status", "active")
      .eq("category", category)
      .neq("id", productId)
      .order("created_at", { ascending: false })
      .limit(take),
  );
  return ((data ?? []) as unknown as CardRow[]).map((r) => toCard(r, locale));
}

export async function searchProducts(q: string, take = 24, locale: string): Promise<ProductCardDTO[]> {
  const term = q.trim().replace(/[,()*%]/g, " ").trim();
  if (!term) return [];
  // Always match the Latin columns (SKUs, English queries work on /ar too); on Arabic,
  // also match the Arabic copy so an Arabic query finds products whose _ar fields are set.
  const filters = [
    `title.ilike.*${term}*`,
    `product_code.ilike.*${term}*`,
    `materials.ilike.*${term}*`,
    `description.ilike.*${term}*`,
  ];
  if (locale === "ar") {
    filters.push(`title_ar.ilike.*${term}*`, `materials_ar.ilike.*${term}*`, `description_ar.ilike.*${term}*`);
  }
  const { data } = await cardImages(
    supabase.from("products").select(CARD).eq("status", "active").or(filters.join(",")).limit(take),
  );
  return ((data ?? []) as unknown as CardRow[]).map((r) => toCard(r, locale));
}
