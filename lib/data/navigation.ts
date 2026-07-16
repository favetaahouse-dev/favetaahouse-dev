import "server-only";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { supabase } from "@/lib/supabase";

// A single, flat nav entry. Labels are pre-resolved for the active locale so the
// (client) Header/MobileMenu can render them without any i18n lookup of their own.
export type NavItem = { key: string; href: string; label: string; highlight?: boolean };

// Category buckets, in the order an abaya-first store wants them. Each appears only
// when its `products.category` has ≥1 product. `key` doubles as the `nav` i18n key.
const CATEGORY_NAV = [
  { key: "abayas", category: "ABAYA", href: "/collections/abayas" },
  { key: "jalabiyas", category: "JALABIYA", href: "/collections/jalabiyas" },
  { key: "sheilas", category: "SHEILA", href: "/collections/sheilas" },
] as const;

// FEATURE/SEASONAL collections that are just "everything" aliases — never nav items.
const EXCLUDE_COLLECTIONS = new Set(["all", "view-all", "new-in", "shop"]);
// Known collection handle → `nav` i18n key, used as the Arabic label fallback while
// `collections.title_ar` is unpopulated in the seed.
const COLLECTION_NAV_KEY: Record<string, string> = { "travel-collection": "travel" };

type CollectionRow = {
  id: string; handle: string; title: string; title_ar: string | null; kind: string; position: number;
};

/**
 * Builds the top navigation from live catalogue data: only categories/collections
 * that actually hold products appear, so empty collections auto-hide with no config.
 * Order: Home → categories → featured collections → Sale → Our Story.
 */
export const getNavItems = cache(async (locale: string): Promise<NavItem[]> => {
  const t = await getTranslations({ locale, namespace: "nav" });

  const [{ data: products }, { data: collections }, { data: links }] = await Promise.all([
    supabase.from("products").select("category,on_sale"),
    supabase.from("collections").select("id,handle,title,title_ar,kind,position"),
    supabase.from("product_collections").select("collection_id"),
  ]);

  // Category counts come from products.category (NOT membership — the `abayas`
  // collection only lists a fraction of the real category).
  const categoryCount = new Map<string, number>();
  let saleCount = 0;
  for (const p of products ?? []) {
    const c = p.category as string;
    categoryCount.set(c, (categoryCount.get(c) ?? 0) + 1);
    if (p.on_sale) saleCount++;
  }
  const memberCount = new Map<string, number>();
  for (const l of links ?? []) {
    const id = l.collection_id as string;
    memberCount.set(id, (memberCount.get(id) ?? 0) + 1);
  }

  const items: NavItem[] = [{ key: "home", href: "/", label: t("home") }];

  // 1. Category buckets (fixed abaya-first order).
  for (const c of CATEGORY_NAV) {
    if ((categoryCount.get(c.category) ?? 0) > 0) {
      items.push({ key: c.key, href: c.href, label: t(c.key) });
    }
  }

  // 2. Featured/seasonal collections that have real members (e.g. Travel Collection).
  const featureRows = ((collections ?? []) as CollectionRow[])
    .filter(
      (c) =>
        (c.kind === "FEATURE" || c.kind === "SEASONAL") &&
        !EXCLUDE_COLLECTIONS.has(c.handle) &&
        (memberCount.get(c.id) ?? 0) > 0,
    )
    .sort((a, b) => a.position - b.position);
  for (const c of featureRows) {
    const navKey = COLLECTION_NAV_KEY[c.handle];
    const label =
      locale === "ar" ? c.title_ar ?? (navKey ? t(navKey) : c.title) : c.title;
    items.push({ key: c.handle, href: `/collections/${c.handle}`, label });
  }

  // 3. Sale (cross-cutting, highlighted).
  if (saleCount > 0) {
    items.push({ key: "sale", href: "/collections/sales", label: t("sale"), highlight: true });
  }

  // 4. Our Story (editorial, always present).
  items.push({ key: "ourStory", href: "/pages/about-us", label: t("ourStory") });

  return items;
});
