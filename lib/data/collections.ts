import { cacheLife, cacheTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { categoryHandle, LEGACY_HANDLE_TO_CATEGORY } from "@/lib/categories";
import { CARD, cardImages, toCard, type ProductCardDTO } from "./catalog";

export type SortKey =
  | "featured" | "best-selling" | "title-ascending" | "title-descending"
  | "price-ascending" | "price-descending" | "created-descending" | "created-ascending";

export const SORT_KEYS: SortKey[] = [
  "featured", "best-selling", "title-ascending", "title-descending",
  "price-ascending", "price-descending", "created-descending", "created-ascending",
];

const ALL_HANDLES = new Set(["view-all", "all", "new-in", "shop"]);

/**
 * Resolve a collection handle to the `products.category` value it stands for, or null if it
 * isn't a category page. The three built-in handles (abayas/jalabiyas/sheilas) always resolve —
 * even when empty — via their legacy alias; any admin-added category resolves by matching its
 * derived handle against the categories live products actually use.
 */
async function categoryForHandle(handle: string): Promise<string | null> {
  const legacy = LEGACY_HANDLE_TO_CATEGORY[handle];
  if (legacy) return legacy;
  const { data } = await supabase.from("products").select("category").eq("status", "active");
  const values = new Set((data ?? []).map((r) => r.category as string));
  return [...values].find((value) => categoryHandle(value) === handle) ?? null;
}

/**
 * Handles prerendered at build time — the ones the nav, footer and homepage actually link
 * to. Any other handle still renders on first visit (dynamicParams defaults to true), so
 * this is a warm-cache list rather than an allowlist.
 */
export const COLLECTION_HANDLES = [
  "all",
  "abayas",
  "jalabiyas",
  "sheilas",
  "sales",
  "travel-collection",
];
const EMPTY_SENTINEL = "00000000-0000-0000-0000-000000000000";

// The listing query is capped so a runaway catalogue can't silently hit PostgREST's
// max_rows (1000, see supabase/config.toml) and return a truncated page as if complete.
const MAX_COLLECTION_PRODUCTS = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySort(query: any, sort: SortKey) {
  switch (sort) {
    case "title-ascending": return query.order("title", { ascending: true });
    case "title-descending": return query.order("title", { ascending: false });
    case "price-ascending": return query.order("price_min", { ascending: true });
    case "price-descending": return query.order("price_min", { ascending: false });
    case "created-ascending": return query.order("created_at", { ascending: true });
    case "created-descending": return query.order("created_at", { ascending: false });
    default: return query.order("featured", { ascending: false }).order("created_at", { ascending: false });
  }
}

// Canonical fabric taxonomy. `materials` is free text (case dupes, typos, non-fabric
// values); each rule maps the messy raw string onto one clean, shoppable fabric.
const FABRIC_RULES: { value: string; label: string; match: RegExp }[] = [
  { value: "crepe", label: "Crepe", match: /crepe/i },
  { value: "suiting", label: "Suiting", match: /suiting/i },
  { value: "linen", label: "Linen", match: /linen/i },
  { value: "twill", label: "Twill", match: /twill/i },
  { value: "velvet", label: "Velvet", match: /velvet/i },
  { value: "tweed", label: "Tweed", match: /tweed/i },
  { value: "satin", label: "Satin", match: /satin/i },
  { value: "chiffon", label: "Chiffon", match: /chiffon/i },
  { value: "cashmere", label: "Cashmere", match: /ca[sh]+mere/i }, // also catches the "Cahmere" typo
  { value: "cotton", label: "Cotton", match: /cotton/i },
  { value: "silk", label: "Silk", match: /silk/i },
  { value: "georgette", label: "Georgette", match: /georgette/i },
  { value: "jersey", label: "Jersey", match: /jersey/i },
  { value: "nada", label: "Nada", match: /nada/i },
];

/** Map a free-text materials string onto a canonical fabric, or null if none matches. */
function normalizeFabric(raw: string | null): { value: string; label: string } | null {
  if (!raw) return null;
  for (const rule of FABRIC_RULES) {
    if (rule.match.test(raw)) return { value: rule.value, label: rule.label };
  }
  return null;
}

/** Intersect a set of id-constraints. `null` means "no constraint" (everything). */
function intersectIds(sets: (string[] | null)[]): string[] | null {
  const arrays = sets.filter((s): s is string[] => s !== null);
  if (arrays.length === 0) return null;
  let acc = new Set(arrays[0]);
  for (const arr of arrays.slice(1)) {
    const s = new Set(arr);
    acc = new Set([...acc].filter((x) => s.has(x)));
  }
  return [...acc];
}

/**
 * Single source of truth for "which products belong to this collection handle".
 *   null => the "everything" set (no id filter)
 *   []   => genuinely empty (unknown / empty handle)
 *   ids  => explicit product-id set
 * Used by both the listing query and the facet query so they can never diverge.
 */
async function resolveCollectionProductIds(handle: string): Promise<string[] | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  // Reserved handles win first so a category can never shadow Sale / the everything pages.
  if (handle === "sales" || handle === "sale") {
    const { data } = await supabase.from("products").select("id").eq("on_sale", true).eq("status", "active");
    return (data ?? []).map((r) => r.id as string);
  }
  if (ALL_HANDLES.has(handle)) return null;
  const cat = await categoryForHandle(handle);
  if (cat) {
    const { data } = await supabase.from("products").select("id").eq("category", cat).eq("status", "active");
    return (data ?? []).map((r) => r.id as string);
  }
  // Membership: only products linked to a collection with this handle. Unknown or
  // empty handles return [] here — which renders an empty state, not the full catalog.
  const { data } = await supabase
    .from("products")
    .select("id, product_collections!inner(collection:collections!inner(handle))")
    .eq("product_collections.collection.handle", handle)
    .eq("status", "active");
  return (data ?? []).map((r) => r.id as string);
}

export type CollectionQuery = {
  sort?: SortKey;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  color?: string;
  material?: string;
};

export async function getCollectionProducts(handle: string, q: CollectionQuery = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const ids = await resolveCollectionProductIds(handle);

  // Colour + in-stock both live on `variants`. Past 1000 variant rows a plain select truncates
  // silently, so aggregate in the DB (≤ #products rows back) via an RPC.
  let variantIds: string[] | null = null;
  if (q.color || q.inStock) {
    const { data: v } = await supabase.rpc("variant_product_ids", {
      p_color: q.color ?? null,
      p_in_stock: !!q.inStock,
    });
    variantIds = (v as string[]) ?? [];
  }

  // Fabric is normalized from free text, so resolve matching products in JS (keeps the
  // filter identical to the facet list).
  let materialIds: string[] | null = null;
  if (q.material) {
    const { data: pm } = await supabase.from("products").select("id,materials").eq("status", "active");
    materialIds = (pm ?? [])
      .filter((r) => normalizeFabric(r.materials as string | null)?.value === q.material)
      .map((r) => r.id as string);
  }

  const finalIds = intersectIds([ids, variantIds, materialIds]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from("products").select(CARD, { count: "exact" }).eq("status", "active");
  if (finalIds !== null) query = query.in("id", finalIds.length ? finalIds : [EMPTY_SENTINEL]);
  if (q.minPrice != null) query = query.gte("price_min", q.minPrice);
  if (q.maxPrice != null) query = query.lte("price_min", q.maxPrice);

  query = applySort(query, q.sort ?? "featured").limit(MAX_COLLECTION_PRODUCTS);

  const { data, count } = await cardImages(query);
  return { products: ((data ?? []) as Parameters<typeof toCard>[0][]).map(toCard) as ProductCardDTO[], total: count ?? 0 };
}

export type CollectionFacets = {
  colors: { color: string; hex: string | null; count: number }[];
  materials: { value: string; label: string; count: number }[];
};

/** Available colour + fabric facets within a collection's product set (counts = distinct products). */
export async function getCollectionFacets(handle: string): Promise<CollectionFacets> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const ids = await resolveCollectionProductIds(handle);
  const idFilter = ids !== null ? (ids.length ? ids : [EMPTY_SENTINEL]) : null;

  // Distinct-product colour counts, aggregated in the DB so it doesn't truncate at 1000 variants.
  const { data: facetRows } = await supabase.rpc("collection_color_facets", { p_ids: idFilter });
  const colors = ((facetRows ?? []) as { color: string; hex: string | null; product_count: number }[])
    .map((r) => ({ color: r.color, hex: r.hex, count: Number(r.product_count) }))
    .sort((a, b) => b.count - a.count || a.color.localeCompare(b.color));

  let pq = supabase.from("products").select("id,materials").eq("status", "active");
  if (idFilter) pq = pq.in("id", idFilter);
  const { data: prods } = await pq;

  const matMap = new Map<string, { label: string; count: number }>();
  for (const p of prods ?? []) {
    const fabric = normalizeFabric(p.materials as string | null);
    if (!fabric) continue;
    const entry = matMap.get(fabric.value) ?? { label: fabric.label, count: 0 };
    entry.count++;
    matMap.set(fabric.value, entry);
  }
  const materials = [...matMap.entries()]
    .map(([value, e]) => ({ value, label: e.label, count: e.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return { colors, materials };
}

const TITLES: Record<string, string> = {
  abayas: "Abayas", "view-all-abayas": "Abayas", "daily-abayas": "Daily Abayas", "evening-abayas": "Evening Abayas",
  jalabiyas: "Jalabiyas", "view-all-jalabiyas": "Jalabiyas", "daily-jalabiyas": "Daily Jalabiyas",
  "evening-jalabiyas": "Evening Jalabiyas", liberty: "Liberty", sheilas: "Sheilas", sales: "Sale",
  "view-all": "View All", all: "Shop", "new-in": "New In", "travel-collection": "Travel Collection",
  "pre-winter": "Pre-Winter", "winter-2025": "Winter", "ramadan-2026": "Ramadan Collection",
  "eid-collection": "Eid Collection", "black-collection": "Black Collection", "eid-al-adha-collection-2026": "Eid Al-Adha 2026",
};

/** generateMetadata and the page body both ask for the same handle. */
export async function getCollectionTitle(handle: string): Promise<string> {
  "use cache";
  cacheLife("days");
  cacheTag("content");
  if (TITLES[handle]) return TITLES[handle];
  const { data } = await supabase.from("collections").select("title").eq("handle", handle).maybeSingle();
  return data?.title ?? handle.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export async function getPriceRange(): Promise<{ min: number; max: number }> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const { data } = await supabase.rpc("price_range");
  const row = Array.isArray(data) ? data[0] : data;
  return { min: row?.min ?? 0, max: row?.max ?? 390000 };
}
