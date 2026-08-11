// All prices are stored in minor units (cents), QAR base — matching the source Shopify data.

export const CURRENCIES = {
  QAR: { code: "QAR", rate: 1, label: "Qatari Rial" },
  USD: { code: "USD", rate: 0.2747, label: "US Dollar" },
  SAR: { code: "SAR", rate: 1.0299, label: "Saudi Riyal" },
  AED: { code: "AED", rate: 1.009, label: "UAE Dirham" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

const nf = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format cents (QAR base) into a display string like "QAR 1,650.00". */
export function formatMoney(cents: number, currency: CurrencyCode = "QAR"): string {
  const amount = (cents / 100) * CURRENCIES[currency].rate;
  return `${currency} ${nf.format(amount)}`;
}

/** Percentage off, given price and compare-at (both cents). */
export function discountPct(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/**
 * Parse an admin-entered price (major units, QAR) into integer fils for storage.
 * A whole number is taken as whole rials — no decimal means append `.00` (450 → 45000);
 * a typed decimal is honoured down to the fils (100.5 → 10050). Non-numeric or negative → 0.
 */
export function parsePriceToFils(input: string | number): number {
  const n = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

/**
 * Fils → the major-unit string prefilled into an admin price box, shown exactly as stored:
 * a whole rial keeps its ".00" (45000 → "450.00") and cents are shown to the fils (10050 → "100.50").
 */
export function filsToPriceInput(fils: number): string {
  return (fils / 100).toFixed(2);
}

/** A fat-finger ceiling: QAR 1,000,000. The storefront's own price filter tops out at 390000 fils
 *  (QAR 3,900), so this is ~250x headroom and cannot reject a real product. */
export const MAX_PRICE_FILS = 100_000_000;

/** One phrasing for "that isn't a price", used everywhere the admin can mistype one. */
export const PRICE_INPUT_HINT = "Enter QAR — 450 or 450.50";

/**
 * The strict admin price parse: QAR major units → integer fils, or NULL when the input is not a
 * price the owner clearly meant.
 *
 * This exists because parsePriceToFils above answers 0 to everything it dislikes, and an admin
 * price box cannot live with that: "" and "abc" and "-5" all become a real, saveable QAR 0.00 that
 * silently makes a product free and drags its card price to zero. The difference between "typed
 * nothing" and "typed zero" has to survive, so this returns null for the first and 0 for the
 * second, and the caller decides.
 *
 *   ""  "   "  "abc"  "-5"  "450.005"  ">1,000,000"  → null
 *   "0"  "0.00"                                      → 0      (an explicit zero is a real price)
 *   "450"  "450."                                    → 45000
 *   "450.5"  ".5"                                    → 45050  50
 *
 * Parsed by regex into integer arithmetic rather than `n * 100`, because that multiplication is
 * not exact in binary floating point: 1.005 * 100 is 100.49999999999999, so Math.round stores
 * 1.00 for a typed 1.005 and nobody is told. Here a third decimal is refused outright instead.
 */
export function parsePriceStrict(input: string | number): number | null {
  const s = String(input).trim();
  if (!s) return null;
  // Digits, then at most two decimals. Rejects "1e3", "+450", "450,50" and "450.005" by shape.
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  // Both halves empty means a bare "." — a dot is not a number.
  if (!m || (!m[1] && !m[2])) return null;
  const fils = Number(m[1] || "0") * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(fils) || fils > MAX_PRICE_FILS) return null;
  return fils;
}
