import { cacheLife, cacheTag } from "next/cache";
import { supabase } from "@/lib/supabase";

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
};

// PostgREST select for card rows (images/variants ordered by position via query below).
// Shared with lib/data/collections.ts so the two listing queries can't drift apart.
export const CARD =
  "handle,title,title_ar,category,on_sale,price_min,price_max,images:product_images(url,position),variants(color,color_hex,price,compare_at,available,position)";

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
  images: { url: string; position: number }[];
  variants: { color: string; color_hex: string | null; price: number; compare_at: number | null; available: boolean; position: number }[];
};

export function toCard(p: CardRow, locale: string): ProductCardDTO {
  const images = [...(p.images ?? [])].sort((a, b) => a.position - b.position);
  const variants = [...(p.variants ?? [])].sort((a, b) => a.position - b.position);
  const swatchMap = new Map<string, string | null>();
  let compareAtMax: number | null = null;
  for (const v of variants) {
    if (!swatchMap.has(v.color)) swatchMap.set(v.color, v.color_hex);
    if (v.compare_at && v.compare_at > v.price) compareAtMax = Math.max(compareAtMax ?? 0, v.compare_at);
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
    swatches: [...swatchMap.entries()].map(([color, hex]) => ({ color, hex })),
    inStock: variants.some((v) => v.available),
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
  const featured = ((data ?? []) as CardRow[]).map((r) => toCard(r, locale));
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
  for (const row of (data ?? []) as CardRow[]) {
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
  return ((data ?? []) as CardRow[]).map((r) => toCard(r, locale));
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
  variants: {
    id: string; color: string; colorHex: string | null; size: string; sku: string | null;
    price: number; compareAt: number | null; stock: number; available: boolean; imageUrl: string | null; position: number;
  }[];
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
        "images:product_images(id,url,alt,position),variants(id,color,color_hex,size,sku,price,compare_at,stock,available,image_url,position)",
    )
    .eq("handle", handle)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  const p = data as unknown as Record<string, unknown> & {
    images: { id: string; url: string; alt: string | null; position: number }[];
    variants: { id: string; color: string; color_hex: string | null; size: string; sku: string | null; price: number; compare_at: number | null; stock: number; available: boolean; image_url: string | null; position: number }[];
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
    variants: [...p.variants]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        id: v.id, color: v.color, colorHex: v.color_hex, size: v.size, sku: v.sku,
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
  return ((data ?? []) as CardRow[]).map((r) => toCard(r, locale));
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
  return ((data ?? []) as CardRow[]).map((r) => toCard(r, locale));
}
