import "server-only";
import { supabase } from "@/lib/supabase";

export type AdminProductRow = {
  id: string; handle: string; title: string; category: string; status: string;
  featured: boolean; onSale: boolean; priceMin: number; priceMax: number;
  tags: string[]; variantCount: number; totalStock: number;
};

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const { data } = await supabase
    .from("products")
    .select("id,handle,title,category,status,featured,on_sale,price_min,price_max,tags,variants(stock)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((p) => {
    const variants = (p.variants ?? []) as { stock: number }[];
    return {
      id: p.id, handle: p.handle, title: p.title, category: p.category, status: p.status,
      featured: p.featured, onSale: p.on_sale, priceMin: p.price_min, priceMax: p.price_max,
      tags: p.tags ?? [],
      variantCount: variants.length,
      totalStock: variants.reduce((s, v) => s + (v.stock ?? 0), 0),
    };
  });
}

export type AdminVariant = {
  id: string; color: string; colorHex: string | null; size: string; sku: string | null;
  price: number; compareAt: number | null; stock: number; available: boolean; position: number;
};

export type AdminProduct = {
  id: string; handle: string; title: string; titleAr: string | null;
  description: string | null; descriptionAr: string | null; productCode: string | null;
  materials: string | null; materialsAr: string | null; modelSize: string | null;
  details: string | null; detailsAr: string | null; packaging: string | null;
  category: string; status: string; tags: string[]; featured: boolean; onSale: boolean;
  priceMin: number; priceMax: number;
  images: { id: string; url: string; alt: string | null; position: number }[];
  variants: AdminVariant[];
};

const FULL_SELECT =
  "id,handle,title,title_ar,description,description_ar,product_code,materials,materials_ar," +
  "model_size,details,details_ar,packaging,category,status,tags,featured,on_sale,price_min,price_max," +
  "images:product_images(id,url,alt,position),variants(id,color,color_hex,size,sku,price,compare_at,stock,available,position)";

type FullRow = {
  id: string; handle: string; title: string; title_ar: string | null;
  description: string | null; description_ar: string | null; product_code: string | null;
  materials: string | null; materials_ar: string | null; model_size: string | null;
  details: string | null; details_ar: string | null; packaging: string | null;
  category: string; status: string; tags: string[] | null; featured: boolean; on_sale: boolean;
  price_min: number; price_max: number;
  images: { id: string; url: string; alt: string | null; position: number }[];
  variants: {
    id: string; color: string; color_hex: string | null; size: string; sku: string | null;
    price: number; compare_at: number | null; stock: number; available: boolean; position: number;
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
    priceMin: p.price_min, priceMax: p.price_max,
    images: [...(p.images ?? [])].sort((a, b) => a.position - b.position),
    variants: [...(p.variants ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        id: v.id, color: v.color, colorHex: v.color_hex, size: v.size, sku: v.sku,
        price: v.price, compareAt: v.compare_at, stock: v.stock, available: v.available, position: v.position,
      })),
  };
}

export type InventoryRow = {
  variantId: string; productId: string; productTitle: string; handle: string;
  color: string; size: string; sku: string | null; stock: number; available: boolean;
};

export async function listInventory(): Promise<InventoryRow[]> {
  const { data } = await supabase
    .from("variants")
    .select("id,color,size,sku,stock,available,product_id,products(title,handle)")
    .order("stock", { ascending: true });
  type Row = {
    id: string; color: string; size: string; sku: string | null; stock: number; available: boolean;
    product_id: string; products: { title: string; handle: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((v) => ({
    variantId: v.id, productId: v.product_id,
    productTitle: v.products?.title ?? "", handle: v.products?.handle ?? "",
    color: v.color, size: v.size, sku: v.sku, stock: v.stock, available: v.available,
  }));
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
