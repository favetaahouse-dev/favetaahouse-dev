import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_CATEGORIES,
  NEW_IN,
  categoryHandle,
  categoryLabelFallback,
  categoryLabelKey,
  normalizeCategory,
  sortCategories,
} from "@/lib/categories";

// One category link. Labels are pre-resolved for the active locale so the (client)
// Header/MobileMenu can render them without any i18n lookup of their own.
export type NavItem = {
  key: string;
  href: string;
  label: string;
  /**
   * The `products.category` value the link lists, so a client can match products to it — or
   * null for New In, which lists every category's newest pieces rather than one category's.
   */
  value: string | null;
};

/**
 * The "Collections" list shared by every navigation surface — the header dropdown, the drawer,
 * the bottom bar's sheet, the footer and the homepage filter.
 *
 * New In first, then the house categories (lib/categories.ts), which show at all times, even
 * while nothing is filed under one. After them comes any category an admin has typed on a
 * product, for as long as a live product uses it — a draft must not conjure a nav item. The
 * `collections` table (seasonal and feature collections scraped from the old store) is not part
 * of this; those pages still resolve by URL. Admin product saves expire the "nav" tag
 * (lib/actions/products.ts).
 */
export async function getNavCategories(locale: string): Promise<NavItem[]> {
  "use cache";
  cacheLife("days");
  cacheTag("nav");
  const t = await getTranslations({ locale, namespace: "nav" });

  const { data: products } = await supabase.from("products").select("category").eq("status", "active");
  const live = (products ?? []).map((p) => normalizeCategory((p.category as string) ?? "")).filter(Boolean);
  const values = sortCategories([...new Set([...DEFAULT_CATEGORIES, ...live])]);

  return [
    { key: NEW_IN.handle, href: `/collections/${NEW_IN.handle}`, label: t(NEW_IN.labelKey), value: null },
    ...values.map((value) => {
      const handle = categoryHandle(value);
      const labelKey = categoryLabelKey(value);
      return {
        key: handle,
        href: `/collections/${handle}`,
        label: labelKey ? t(labelKey) : categoryLabelFallback(value),
        value,
      };
    }),
  ];
}
