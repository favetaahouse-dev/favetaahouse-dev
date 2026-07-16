"use server";

import { searchProducts } from "@/lib/data/catalog";

export async function searchAction(q: string) {
  return searchProducts(q, 8);
}
