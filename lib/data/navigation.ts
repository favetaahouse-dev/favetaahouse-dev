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

// One category link. Labels are pre-resolved for the active locale so the (client)
// Header/MobileMenu can render them without any i18n lookup of their own.
export type NavItem = {
  key: string;
  href: string;
  label: string;
  /** The stored `products.category` value, so a client can match products to the link. */
  value: string;
};

/**
 * The "Collections" list shared by every navigation surface — the header dropdown, the drawer,
 * the bottom bar's sheet, the footer and the homepage filter — and it is exactly the product
 * categories that live products use: no more, no less.
 *
 * Derived from products.category rather than from the `collections` table, so a category an
 * admin types on a product appears as soon as the product is live, and one whose last product
 * is unpublished disappears, with no config either way. Seasonal and feature collections (the
 * `collections` table) are not categories and are deliberately left out; their pages still
 * resolve by URL. Admin product saves expire the "nav" tag (lib/actions/products.ts).
 *
 * Order: abaya-first, then alphabetical; OTHER stays out, as it always has (lib/categories.ts).
 */
export async function getNavCategories(locale: string): Promise<NavItem[]> {
  "use cache";
  cacheLife("days");
  cacheTag("nav");
  const t = await getTranslations({ locale, namespace: "nav" });

  // Only live products decide which categories appear — a draft must not conjure a nav item.
  const { data: products } = await supabase.from("products").select("category").eq("status", "active");
  const live = new Set((products ?? []).map((p) => p.category as string).filter(Boolean));

  // The built-in three keep their translated `nav` labels; a new one falls back to a
  // title-cased label until a translation is added.
  return sortCategoriesForNav([...live]).map((value) => {
    const handle = categoryHandle(value);
    const legacyKey = LEGACY_CATEGORY_HANDLES[value];
    return {
      key: handle,
      href: `/collections/${handle}`,
      label: legacyKey ? t(legacyKey) : categoryLabelFallback(value),
      value,
    };
  });
}
