"use server";

import { supabase } from "@/lib/supabase";
import { toCard, type ProductCardDTO } from "@/lib/data/catalog";

const CARD =
  "handle,title,title_ar,category,on_sale,price_min,price_max,images:product_images(url,alt,position),variants(color,color_hex,price,compare_at,available,position)";

export async function getCardsByHandles(handles: string[], locale: string): Promise<ProductCardDTO[]> {
  if (!handles.length) return [];
  const { data } = await supabase.from("products").select(CARD).in("handle", handles);
  const byHandle = new Map((data ?? []).map((r) => [r.handle as string, r]));
  return handles
    .map((h) => byHandle.get(h))
    .filter(Boolean)
    .map((r) => toCard(r as Parameters<typeof toCard>[0], locale));
}
