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
