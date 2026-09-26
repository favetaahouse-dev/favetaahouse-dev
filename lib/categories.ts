/**
 * Product categories are dynamic: admins can type a brand-new one on any product (the DB
 * CHECK that used to freeze the list was dropped in 20260719120000_dynamic_categories.sql).
 * This is the single source of truth for turning a stored category value into its storefront
 * URL handle and display label, shared by the admin form, the nav (lib/data/navigation.ts)
 * and the collection pages (lib/data/collections.ts).
 *
 * No `server-only`: imported by both the server data layer and client admin components.
 *
 * Values are stored UPPERCASE. Handles are lowercase slugs.
 */

/**
 * The house's categories, in menu order. They are the admin picker's defaults, and they show in
 * the navigation and the homepage filter at all times — even while nothing is filed under one;
 * the owner's call, 2026-09-25. Each has a translated `nav` label (`labelKey`) and a plural URL
 * handle to match the long-standing /collections/abayas.
 *
 * An admin can still type a new category on any product. It then appears after these wherever a
 * live product uses it, labelled with its own title-cased value until a translation is added.
 */
export const HOUSE_CATEGORIES = [
  { value: "ABAYA", handle: "abayas", labelKey: "abayas" },
  { value: "KAFTAN", handle: "kaftans", labelKey: "kaftans" },
  { value: "DRESS", handle: "dresses", labelKey: "dresses" },
  { value: "READY TO WEAR", handle: "ready-to-wear", labelKey: "readyToWear" },
] as const;

/** The admin picker's defaults: the house categories' stored values, in menu order. */
export const DEFAULT_CATEGORIES: string[] = HOUSE_CATEGORIES.map((c) => c.value);

/**
 * New In leads every category list, but nothing is filed under it: it is the newest arrivals
 * across all of them, so it fills itself and can never be empty while anything is on sale. Its
 * page is the everything-set sorted newest first (lib/data/collections.ts).
 */
export const NEW_IN = { handle: "new-in", labelKey: "newIn" } as const;

type HouseCategory = (typeof HOUSE_CATEGORIES)[number];
const BY_VALUE = new Map<string, HouseCategory>(HOUSE_CATEGORIES.map((c) => [c.value, c]));
const BY_HANDLE = new Map<string, HouseCategory>(HOUSE_CATEGORIES.map((c) => [c.handle, c]));

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
  return BY_VALUE.get(v)?.handle ?? slugify(v);
}

/**
 * A house category's handle → its stored value, or null for any other handle. Resolves even
 * while the category is empty, which is what lets its page render an honest empty state rather
 * than falling through to an unrelated collection.
 */
export function houseCategoryForHandle(handle: string): string | null {
  return BY_HANDLE.get(handle)?.value ?? null;
}

/** The `nav` i18n key for a house category's label, or null for a category an admin added. */
export function categoryLabelKey(value: string): string | null {
  return BY_VALUE.get(normalizeCategory(value))?.labelKey ?? null;
}

/** Title-cased label for a category with no i18n key (e.g. "EVENING WEAR" → "Evening Wear"). */
export function categoryLabelFallback(value: string): string {
  return normalizeCategory(value)
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** The house categories first, in their fixed order, then any others alphabetically. */
export function sortCategories(values: string[]): string[] {
  const order: string[] = DEFAULT_CATEGORIES;
  return [...values].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
