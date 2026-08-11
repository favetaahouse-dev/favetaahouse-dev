/**
 * The admin-editable size and length lists (Admin → Content → Variant Options) and the
 * shared helpers for turning variant rows into stable keys and human labels.
 *
 * No `server-only`: imported by both the server data layer and client admin/storefront
 * components. The lists are stored in the CMS as comma-joined strings.
 */

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

/** Uniqueness key for a variant cell — mirrors the DB unique (color, size, length, tack_tack). */
export function cellKey(color: string, size: string, length: number, tackTack: boolean): string {
  return `${color}|${size}|${length}|${tackTack ? 1 : 0}`;
}

/**
 * One human label for a variant across cart, orders, email and admin, so those six sites
 * can't drift. Length 0 and the degenerate no-tack-tack case are omitted so legacy/One-Size
 * variants read cleanly.
 */
export function variantLabel(v: {
  color: string;
  size: string;
  length?: number | null;
  tackTack?: boolean | null;
}): string {
  const parts = [v.color, v.size];
  if (v.length != null && v.length > 0) parts.push(`${v.length}"`);
  if (v.tackTack) parts.push("Tack Tack");
  return parts.join(" / ");
}
