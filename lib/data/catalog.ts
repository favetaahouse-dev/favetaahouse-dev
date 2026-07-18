import { cache } from "react";
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
  "handle,title,category,on_sale,price_min,price_max,images:product_images(url,position),variants(color,color_hex,price,compare_at,available,position)";

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
  category: string;
  on_sale: boolean;
  price_min: number;
  price_max: number;
  images: { url: string; position: number }[];
  variants: { color: string; color_hex: string | null; price: number; compare_at: number | null; available: boolean; position: number }[];
};

export function toCard(p: CardRow): ProductCardDTO {
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
    title: p.title,
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

export async function getFeaturedProducts(take = 16): Promise<ProductCardDTO[]> {
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
  const featured = ((data ?? []) as CardRow[]).map(toCard);
  // Never leave the homepage empty — fall back to the newest active products.
  return featured.length > 0 ? featured : getNewestProducts(take);
}

export async function getNewestProducts(take = 8): Promise<ProductCardDTO[]> {
  const { data } = await cardImages(
    supabase.from("products").select(CARD).eq("status", "active").order("created_at", { ascending: false }).limit(take),
  );
  return ((data ?? []) as CardRow[]).map(toCard);
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
 * Deduped per request: every product page asks for this twice — once in generateMetadata
 * and once in the page body — and it is the heaviest single-product query we run.
 */
export const getProductByHandle = cache(async (handle: string): Promise<FullProduct | null> => {
  const { data } = await supabase
    .from("products")
    .select(
      "id,handle,title,category,product_code,description,materials,model_size,details,packaging,price_min,price_max," +
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
  return {
    id: p.id as string,
    handle: p.handle as string,
    title: p.title as string,
    category: p.category as string,
    productCode: (p.product_code as string) ?? null,
    description: (p.description as string) ?? null,
    materials: (p.materials as string) ?? null,
    modelSize: (p.model_size as string) ?? null,
    details: (p.details as string) ?? null,
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
});

export async function getAllProductHandles(): Promise<string[]> {
  const { data } = await supabase.from("products").select("handle").eq("status", "active");
  return (data ?? []).map((r) => r.handle as string);
}

export async function getRelatedProducts(productId: string, category: string, take = 4): Promise<ProductCardDTO[]> {
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
  return ((data ?? []) as CardRow[]).map(toCard);
}

export async function searchProducts(q: string, take = 24): Promise<ProductCardDTO[]> {
  const term = q.trim().replace(/[,()*%]/g, " ").trim();
  if (!term) return [];
  const { data } = await cardImages(
    supabase
      .from("products")
      .select(CARD)
      .eq("status", "active")
      .or(`title.ilike.*${term}*,product_code.ilike.*${term}*,materials.ilike.*${term}*,description.ilike.*${term}*`)
      .limit(take),
  );
  return ((data ?? []) as CardRow[]).map(toCard);
}
