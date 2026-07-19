import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { supabase } from "@/lib/supabase";
import {
  LEGACY_CATEGORY_HANDLES,
  categoryHandle,
  categoryLabelFallback,
  sortCategoriesForNav,
} from "@/lib/categories";

// A single, flat nav entry. Labels are pre-resolved for the active locale so the
// (client) Header/MobileMenu can render them without any i18n lookup of their own.
export type NavItem = { key: string; href: string; label: string; highlight?: boolean };

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
export async function getNavItems(locale: string): Promise<NavItem[]> {
  "use cache";
  cacheLife("days");
  cacheTag("nav");
  const t = await getTranslations({ locale, namespace: "nav" });

  const [{ data: products }, { data: collections }, { data: links }] = await Promise.all([
    // Only live products decide which categories appear — drafts must not conjure a nav item.
    supabase.from("products").select("category,on_sale").eq("status", "active"),
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

  // 1. Category buckets — derived from live product categories, not a fixed list, so a
  // brand-new category an admin adds surfaces automatically (abaya-first, then alphabetical;
  // OTHER stays hidden). The built-in three keep their translated `nav` labels; new ones fall
  // back to a title-cased label until/unless a translation is added.
  const liveCategories = sortCategoriesForNav(
    [...categoryCount.keys()].filter((c) => (categoryCount.get(c) ?? 0) > 0),
  );
  for (const value of liveCategories) {
    const handle = categoryHandle(value);
    const legacyKey = LEGACY_CATEGORY_HANDLES[value];
    items.push({
      key: handle,
      href: `/collections/${handle}`,
      label: legacyKey ? t(legacyKey) : categoryLabelFallback(value),
    });
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
}
