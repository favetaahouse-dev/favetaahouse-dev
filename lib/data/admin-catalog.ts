import "server-only";
import { supabase } from "@/lib/supabase";

export type AdminProductRow = {
  id: string; handle: string; title: string; category: string; status: string;
  featured: boolean; onSale: boolean; priceMin: number; priceMax: number;
  tags: string[]; variantCount: number; totalStock: number;
  fulfillment: string;
};

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const { data } = await supabase
    .from("products")
    .select("id,handle,title,category,status,featured,on_sale,price_min,price_max,tags,fulfillment,variants(stock)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((p) => {
    const variants = (p.variants ?? []) as { stock: number }[];
    return {
      id: p.id, handle: p.handle, title: p.title, category: p.category, status: p.status,
      featured: p.featured, onSale: p.on_sale, priceMin: p.price_min, priceMax: p.price_max,
      tags: p.tags ?? [],
      variantCount: variants.length,
      totalStock: variants.reduce((s, v) => s + (v.stock ?? 0), 0),
      fulfillment: (p as { fulfillment?: string }).fulfillment ?? "READY_TO_WEAR",
    };
  });
}

export type AdminVariant = {
  id: string; color: string; colorHex: string | null; size: string;
  sku: string | null; price: number; compareAt: number | null; stock: number; available: boolean; position: number;
};

export type AdminColorRow = {
  id: string; name: string; nameAr: string | null; hex: string | null; position: number;
};

export type AdminProduct = {
  id: string; handle: string; title: string; titleAr: string | null;
  description: string | null; descriptionAr: string | null; productCode: string | null;
  materials: string | null; materialsAr: string | null; modelSize: string | null;
  details: string | null; detailsAr: string | null; packaging: string | null;
  category: string; status: string; tags: string[]; featured: boolean; onSale: boolean;
  priceMin: number; priceMax: number; totalQty: number;
  images: { id: string; url: string; alt: string | null; position: number }[];
  colors: AdminColorRow[];
  variants: AdminVariant[];
  fulfillment: string;
  mtoPrice: number | null; mtoCompareAt: number | null;
  mtoLeadMin: number | null; mtoLeadMax: number | null; mtoFields: string[];
};

const FULL_SELECT =
  "id,handle,title,title_ar,description,description_ar,product_code,materials,materials_ar," +
  "model_size,details,details_ar,packaging,category,status,tags,featured,on_sale,price_min,price_max,total_qty," +
  "fulfillment,mto_price,mto_compare_at,mto_lead_min,mto_lead_max,mto_fields," +
  "images:product_images(id,url,alt,position),colors:product_colors(id,name,name_ar,hex,position)," +
  "variants(id,color,color_hex,size,sku,price,compare_at,stock,available,position)";

type FullRow = {
  id: string; handle: string; title: string; title_ar: string | null;
  description: string | null; description_ar: string | null; product_code: string | null;
  materials: string | null; materials_ar: string | null; model_size: string | null;
  details: string | null; details_ar: string | null; packaging: string | null;
  category: string; status: string; tags: string[] | null; featured: boolean; on_sale: boolean;
  price_min: number; price_max: number; total_qty: number;
  fulfillment: string; mto_price: number | null; mto_compare_at: number | null;
  mto_lead_min: number | null; mto_lead_max: number | null; mto_fields: string[] | null;
  images: { id: string; url: string; alt: string | null; position: number }[];
  colors: { id: string; name: string; name_ar: string | null; hex: string | null; position: number }[];
  variants: {
    id: string; color: string; color_hex: string | null; size: string;
    sku: string | null; price: number; compare_at: number | null; stock: number; available: boolean; position: number;
  }[];
};

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  const { data } = await supabase.from("products").select(FULL_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const p = data as unknown as FullRow;
  return {
    id: p.id, handle: p.handle, title: p.title, titleAr: p.title_ar,
    description: p.description, descriptionAr: p.description_ar, productCode: p.product_code,
    materials: p.materials, materialsAr: p.materials_ar, modelSize: p.model_size,
    details: p.details, detailsAr: p.details_ar, packaging: p.packaging,
    category: p.category, status: p.status, tags: p.tags ?? [], featured: p.featured, onSale: p.on_sale,
    priceMin: p.price_min, priceMax: p.price_max, totalQty: p.total_qty ?? 0,
    fulfillment: p.fulfillment ?? "READY_TO_WEAR",
    mtoPrice: p.mto_price, mtoCompareAt: p.mto_compare_at,
    mtoLeadMin: p.mto_lead_min, mtoLeadMax: p.mto_lead_max, mtoFields: p.mto_fields ?? [],
    images: [...(p.images ?? [])].sort((a, b) => a.position - b.position),
    colors: [...(p.colors ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name, nameAr: c.name_ar, hex: c.hex, position: c.position })),
    variants: [...(p.variants ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        id: v.id, color: v.color, colorHex: v.color_hex, size: v.size,
        sku: v.sku, price: v.price, compareAt: v.compare_at, stock: v.stock, available: v.available, position: v.position,
      })),
  };
}

export type InventoryRow = {
  variantId: string; productId: string; productTitle: string; handle: string;
  color: string; size: string; sku: string | null; stock: number; available: boolean;
};

/** Lowest-stock variants first, capped. Count is exact regardless of the cap. */
export async function listInventory(limit = 500): Promise<{ rows: InventoryRow[]; total: number }> {
  const { data, count } = await supabase
    .from("variants")
    // !inner + the mode filter: a made-to-order product holds no stock, so its rows would sit
    // permanently at the top of a lowest-stock-first list as a problem nobody can fix. Belt and
    // braces for a product switched BOTH -> MADE_TO_ORDER with variant rows left behind.
    .select("id,color,size,sku,stock,available,product_id,products!inner(title,handle,fulfillment)", { count: "exact" })
    .neq("products.fulfillment", "MADE_TO_ORDER")
    .order("stock", { ascending: true })
    .order("product_id")
    .limit(limit);
  type Row = {
    id: string; color: string; size: string;
    sku: string | null; stock: number; available: boolean;
    product_id: string; products: { title: string; handle: string; fulfillment: string } | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).map((v) => ({
    variantId: v.id, productId: v.product_id,
    productTitle: v.products?.title ?? "", handle: v.products?.handle ?? "",
    color: v.color, size: v.size,
    sku: v.sku, stock: v.stock, available: v.available,
  }));
  return { rows, total: count ?? rows.length };
}

export async function listVariantAdjustments(variantId: string, limit = 50) {
  const { data } = await supabase
    .from("inventory_adjustments")
    .select("id,delta,stock_after,reason,note,actor_email,created_at")
    .eq("variant_id", variantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
