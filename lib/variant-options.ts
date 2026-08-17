/**
 * The admin-editable size and length lists (Admin → Content → Variant Options) and the
 * shared helpers for turning variant rows into stable keys and human labels.
 *
 * No `server-only`: imported by both the server data layer and client admin/storefront
 * components. The lists are stored in the CMS as comma-joined strings.
 */

/**
 * How many colours one product may offer.
 *
 * Here rather than beside the colour queries in lib/data/product-colors.ts, which is
 * `server-only`: the admin's colour editor is a Client Component and needs this number, and a
 * value import from a server-only module pulls the Supabase client into the browser bundle.
 * This file already exists to be shared by both sides for exactly that reason.
 *
 * The cap is not a style rule. product_colors is read on every product page, so an unbounded
 * list is payload the shopper pays for; and PostgREST silently truncates at db.max_rows, so an
 * unbounded read could hand back a partial name -> id map and attach variants to the wrong colour.
 */
export const MAX_COLORS = 40;

/** Canonical size ordering — mirrors the array in the migration's position recompute. */
export const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "One Size"];

/** Split a comma-joined CMS string into a trimmed, de-duped, order-preserving list. */
export function parseList(s: string | undefined | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of (s ?? "").split(",")) {
    const v = raw.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** Same, coerced to whole non-negative numbers (lengths are integers). */
export function parseLengths(s: string | undefined | null): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of parseList(s)) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Sort sizes by the canonical order, unknown values last (alphabetical among themselves). */
export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// `cellKey` used to live here, describing the DB unique (color, size, length, tack_tack).
// Deleted rather than corrected: that key stopped existing in 20260718120000_stock_per_size.sql
// and the function had no caller anywhere in the repo, so all it could do was tell the next
// reader something about the schema that is no longer true.

/**
 * One human label for a line across the cart drawer, checkout summary, customer order page,
 * admin order page, receipt HTML and both emails, so those six sites can't drift.
 *
 * Made-to-order lines have no size — measurements replace it — so the size slot carries the
 * "Made to Order" marker instead, and the length is dropped: under made-to-order the hem is a
 * measurement, and printing a chip value beside it would give the atelier two numbers for one
 * dimension. Tack Tack survives both modes; it is a finishing choice, not a fit dimension.
 *
 * `filter(Boolean)` is load-bearing rather than defensive: it is what lets a missing size
 * collapse cleanly instead of rendering "Black / ".
 */
export function variantLabel(v: {
  color: string;
  size?: string | null;
  length?: number | null;
  tackTack?: boolean | null;
  madeToOrder?: boolean | null;
  /** Localised by the storefront. Defaults to English — the receipt and emails are English. */
  madeToOrderLabel?: string;
}): string {
  const mto = !!v.madeToOrder;
  const parts: (string | null | undefined)[] = [
    v.color,
    mto ? (v.madeToOrderLabel || "Made to Order") : v.size,
  ];
  if (!mto && v.length != null && v.length > 0) parts.push(`${v.length}"`);
  if (v.tackTack) parts.push("Tack Tack");
  return parts.filter(Boolean).join(" / ");
}
