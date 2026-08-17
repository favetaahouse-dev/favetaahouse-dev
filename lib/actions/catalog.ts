"use server";

import { supabase } from "@/lib/supabase";
import { CARD, cardImages, toCard, type ProductCardDTO } from "@/lib/data/catalog";

/**
 * Wishlist cards, resolved from handles held in the browser's localStorage.
 *
 * The select is IMPORTED rather than declared here. It used to be a near-copy that had already
 * drifted — it still asked variants for the colour columns the swatches were once built from,
 * so once colours moved to their own table this page would have rendered every card without a
 * swatch while the collection grids rendered fine. One string, one shape.
 */
export async function getCardsByHandles(handles: string[], locale: string): Promise<ProductCardDTO[]> {
  if (!handles.length) return [];
  const { data } = await cardImages(supabase.from("products").select(CARD).in("handle", handles));
  const rows = (data ?? []) as unknown as Parameters<typeof toCard>[0][];
  const byHandle = new Map(rows.map((r) => [r.handle, r]));
  return handles
    .map((h) => byHandle.get(h))
    .filter((r): r is Parameters<typeof toCard>[0] => !!r)
    .map((r) => toCard(r, locale));
}
