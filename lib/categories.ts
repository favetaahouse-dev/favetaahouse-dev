/**
 * Product categories are dynamic: admins can type a brand-new one on any product (the DB
 * CHECK that used to freeze the list was dropped in 20260719120000_dynamic_categories.sql).
 * This is the single source of truth for turning a stored category value into its storefront
 * URL handle and display label, shared by the admin form, the nav (lib/data/navigation.ts)
 * and the collection pages (lib/data/collections.ts).
 *
 * No `server-only`: imported by both the server data layer and client admin components.
 *
 * Values are stored UPPERCASE (matching the original four). Handles are lowercase slugs; the
 * original three keep their historical plural handles so existing URLs/i18n keys never break.
 */

/** Always offered in the product picker, even before any product uses them. */
export const DEFAULT_CATEGORIES = ["ABAYA", "JALABIYA", "SHEILA", "OTHER"] as const;

/** Original categories → their historical plural handles (also the `nav` i18n keys). */
export const LEGACY_CATEGORY_HANDLES: Record<string, string> = {
  ABAYA: "abayas",
  JALABIYA: "jalabiyas",
  SHEILA: "sheilas",
};

/** Reverse of LEGACY_CATEGORY_HANDLES: historical handle → category value. */
export const LEGACY_HANDLE_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_CATEGORY_HANDLES).map(([value, handle]) => [handle, value]),
);

/** Categories deliberately kept out of the top nav (still valid on products + landing pages). */
export const NAV_HIDDEN_CATEGORIES = new Set(["OTHER"]);

/** Canonicalize a raw category string for storage: trim, collapse whitespace, UPPERCASE, cap. */
export function normalizeCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase().slice(0, 40);
}

/** Lowercase URL slug used elsewhere too (mirrors slugify in lib/actions/products.ts). */
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Category value → storefront collection handle (`/collections/<handle>`). */
export function categoryHandle(value: string): string {
  const v = normalizeCategory(value);
  return LEGACY_CATEGORY_HANDLES[v] ?? slugify(v);
}

/** Title-cased label for a category with no i18n key (e.g. "KAFTAN" → "Kaftan"). */
export function categoryLabelFallback(value: string): string {
  return normalizeCategory(value)
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Order categories for the nav: the original three first (abaya-first), then any new ones
 * alphabetically. `OTHER` and other hidden categories are dropped.
 */
export function sortCategoriesForNav(values: string[]): string[] {
  const order = ["ABAYA", "JALABIYA", "SHEILA"];
  return values
    .filter((v) => !NAV_HIDDEN_CATEGORIES.has(v))
    .sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
}
