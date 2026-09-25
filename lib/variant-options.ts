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

/**
 * The sizes a made-to-order piece is offered in.
 *
 * A piece that is also sold ready-to-wear already has a size row — its variants — and offering
 * the same sizes made to order keeps the two modes one row of chips. A made-to-order-only piece
 * has no variants, so it takes the house list (Admin → Content → Sizes & Lengths). "One Size"
 * only means something on its own: beside real sizes it is a stocked-sheila fallback that a
 * tailored piece cannot be cut to, so it drops out of any longer list.
 *
 * Shared by the product page, the cart action and checkout so the three can never disagree
 * about what may be ordered.
 */
export function madeToOrderSizes(productSizes: string[], houseSizes: string[]): string[] {
  const own = [...new Set(productSizes)];
  const sizes = sortSizes(own.length ? own : houseSizes);
  return sizes.length > 1 ? sizes.filter((s) => s !== "One Size") : sizes;
}

// `cellKey` used to live here, describing the DB unique (color, size, length, tack_tack).
// Deleted rather than corrected: that key stopped existing in 20260718120000_stock_per_size.sql
// and the function had no caller anywhere in the repo, so all it could do was tell the next
// reader something about the schema that is no longer true.

/**
 * One human label for a line across the cart drawer, checkout summary, customer order page,
 * admin order page, receipt HTML and both emails, so those six sites can't drift.
 *
 * Both modes read the same way — colour, size, length in inches, tack-tack — because both are
 * now chosen from the same chips. A made-to-order line adds its marker at the end, which is
 * what tells the atelier from the packer. A line carried over from the old measurement form has
 * no size or length, and simply collapses to "Colour / Made to Order".
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
  const parts: (string | null | undefined)[] = [v.color, v.size];
  if (v.length != null && v.length > 0) parts.push(`${v.length}"`);
  if (v.tackTack) parts.push("Tack Tack");
  if (v.madeToOrder) parts.push(v.madeToOrderLabel || "Made to Order");
  return parts.filter(Boolean).join(" / ");
}
