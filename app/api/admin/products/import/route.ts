import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { requirePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";
import { normalizeCategory } from "@/lib/categories";
import { BRAND_NAME } from "@/lib/brand";
import { recomputePrices } from "@/lib/data/product-pricing";
import { upsertProductColors, colorsFromVariants } from "@/lib/data/product-colors";

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
  /** Every product this could not fully write. Previously all of these were swallowed and the
   *  response still said ok:true, so a half-imported catalogue looked like a clean run. */
  const failures: { handle: string; error: string }[] = [];

  for (const p of items) {
    if (!p.handle || !p.title) continue;
    // min/max ACROSS the variants. This used to read `variants[0].price` for both, so a product
    // priced 300–900 advertised 300–300 on every collection card.
    const vPrices = (p.variants ?? []).map((v) => v.price).filter((n) => Number.isFinite(n));
    const row = {
      handle: p.handle,
      title: p.title,
      description: p.description ?? null,
      product_code: p.productCode ?? null,
      materials: p.materials ?? null,
      model_size: p.modelSize ?? null,
      details: p.details ?? null,
      packaging: p.packaging ?? null,
      category: p.category ? normalizeCategory(p.category) : "ABAYA",
      // Never trust an imported vendor — a JSON file exported from another store would
      // otherwise carry that store's brand straight back into the catalogue.
      vendor: BRAND_NAME,
      featured: !!p.featured,
      on_sale: !!p.onSale,
      price_min: p.priceMin ?? (vPrices.length ? Math.min(...vPrices) : 0),
      price_max: p.priceMax ?? (vPrices.length ? Math.max(...vPrices) : 0),
    };
    const { data: existing } = await supabase.from("products").select("id").eq("handle", p.handle).maybeSingle();
    let productId: string;
    if (existing) {
      const { error: ue } = await supabase.from("products").update(row).eq("id", existing.id);
      if (ue) { failures.push({ handle: p.handle, error: ue.message }); continue; }
      // NOTE: this deletes before re-inserting, so a failed insert below leaves the product with
      // no variants and no images. The failure is at least reported now rather than hidden behind
      // ok:true; making it atomic needs an insert-then-delete rewrite or an RPC.
      const { error: dv } = await supabase.from("variants").delete().eq("product_id", existing.id);
      if (dv) { failures.push({ handle: p.handle, error: dv.message }); continue; }
      const { error: di } = await supabase.from("product_images").delete().eq("product_id", existing.id);
      if (di) { failures.push({ handle: p.handle, error: di.message }); continue; }
      productId = existing.id as string;
      updated++;
    } else {
      const { data: ins, error } = await supabase.from("products").insert(row).select("id").single();
      if (error || !ins) { failures.push({ handle: p.handle, error: error?.message ?? "insert returned no row" }); continue; }
      productId = ins.id as string;
      created++;
    }
    if (p.variants?.length) {
      // Colours are their own table now, and variants.color_id is NOT NULL — so the colour
      // list has to exist before the rows that point at it. An import file describes a product
      // as a flat colour+size list with no colour list of its own, so derive one.
      //
      // This is the sneakiest call site in the feature: without it an imported product would
      // insert fine under the old shape and then show NO swatches on the product page, because
      // the storefront reads colours from product_colors rather than from the variant grid.
      let colorIds: Map<string, string>;
      try {
        colorIds = await upsertProductColors(productId, colorsFromVariants(p.variants));
      } catch (e) {
        failures.push({ handle: p.handle, error: e instanceof Error ? e.message : "colour sync failed" });
        continue;
      }
      const orphan = p.variants.find((v) => !colorIds.get((v.color ?? "").trim()));
      if (orphan) {
        failures.push({ handle: p.handle, error: `variant colour "${orphan.color}" could not be resolved` });
        continue;
      }
      const { error: ve } = await supabase.from("variants").insert(
        p.variants.map((v, i) => ({
          product_id: productId, color_id: colorIds.get(v.color.trim())!,
          color: v.color, color_hex: v.colorHex ?? null, size: v.size, sku: v.sku ?? null,
          price: v.price, compare_at: v.compareAt ?? null, available: v.available ?? true,
          stock: v.stock ?? (v.available === false ? 0 : 10), position: v.position ?? i,
        })),
      );
      if (ve) { failures.push({ handle: p.handle, error: ve.message }); continue; }
    }
    if (p.images?.length) {
      const { error: ie } = await supabase.from("product_images").insert(
        p.images.map((url, i) => ({ product_id: productId, url, alt: p.title, position: i })),
      );
      if (ie) failures.push({ handle: p.handle, error: ie.message });
    }
    // The authoritative backstop: derives price_min/max from the rows that actually landed, so a
    // wrong explicit priceMin in the file — or a partial variant insert — self-corrects.
    try {
      await recomputePrices(productId);
    } catch (e) {
      failures.push({ handle: p.handle, error: `price range not refreshed: ${e instanceof Error ? e.message : "failed"}` });
    }
  }

  // A bulk import can touch every product, so expire the whole catalogue and
  // the nav, which depends on which categories have live products.
  revalidateTag("products", { expire: 0 });
  revalidateTag("nav", { expire: 0 });
  return NextResponse.json({ ok: failures.length === 0, created, updated, failures });
}
