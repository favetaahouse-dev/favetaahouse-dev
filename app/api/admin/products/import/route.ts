import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImportProduct = {
  handle: string;
  title: string;
  description?: string | null;
  productCode?: string | null;
  materials?: string | null;
  modelSize?: string | null;
  details?: string | null;
  packaging?: string | null;
  category?: string;
  featured?: boolean;
  onSale?: boolean;
  priceMin?: number;
  priceMax?: number;
  images?: string[];
  variants?: {
    color: string; colorHex?: string | null; size: string; sku?: string | null;
    price: number; compareAt?: number | null; available?: boolean; stock?: number; position?: number;
  }[];
};

export async function POST(req: NextRequest) {
  const bad = await requirePermission("products:write");
  if (bad) return bad;

  let items: ImportProduct[];
  try {
    const body = await req.json();
    items = Array.isArray(body) ? body : body.products;
    if (!Array.isArray(items)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Expected a JSON array of products" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  for (const p of items) {
    if (!p.handle || !p.title) continue;
    const row = {
      handle: p.handle,
      title: p.title,
      description: p.description ?? null,
      product_code: p.productCode ?? null,
      materials: p.materials ?? null,
      model_size: p.modelSize ?? null,
      details: p.details ?? null,
      packaging: p.packaging ?? null,
      category: p.category ?? "ABAYA",
      featured: !!p.featured,
      on_sale: !!p.onSale,
      price_min: p.priceMin ?? p.variants?.[0]?.price ?? 0,
      price_max: p.priceMax ?? p.variants?.[0]?.price ?? 0,
    };
    const { data: existing } = await supabase.from("products").select("id").eq("handle", p.handle).maybeSingle();
    let productId: string;
    if (existing) {
      await supabase.from("products").update(row).eq("id", existing.id);
      await supabase.from("variants").delete().eq("product_id", existing.id);
      await supabase.from("product_images").delete().eq("product_id", existing.id);
      productId = existing.id as string;
      updated++;
    } else {
      const { data: ins, error } = await supabase.from("products").insert(row).select("id").single();
      if (error || !ins) continue;
      productId = ins.id as string;
      created++;
    }
    if (p.variants?.length) {
      await supabase.from("variants").insert(
        p.variants.map((v, i) => ({
          product_id: productId, color: v.color, color_hex: v.colorHex ?? null, size: v.size, sku: v.sku ?? null,
          price: v.price, compare_at: v.compareAt ?? null, available: v.available ?? true,
          stock: v.stock ?? (v.available === false ? 0 : 10), position: v.position ?? i,
        })),
      );
    }
    if (p.images?.length) {
      await supabase.from("product_images").insert(
        p.images.map((url, i) => ({ product_id: productId, url, alt: p.title, position: i })),
      );
    }
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, created, updated });
}
