"use server";

import { searchProducts } from "@/lib/data/catalog";

export async function searchAction(q: string, locale: string) {
  return searchProducts(q, 8, locale);
}
