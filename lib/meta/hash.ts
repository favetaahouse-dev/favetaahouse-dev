import "server-only";
import { createHash } from "node:crypto";

/**
 * Advanced Matching: normalise, then SHA-256, then hex.
 *
 * The normalisation is not cosmetic. Meta hashes its own side using these exact rules, and a
 * hash only matches if the input bytes matched — so "Ibra@Example.com " and "ibra@example.com"
 * are two entirely different users as far as Meta is concerned. A normalisation mismatch is the
 * single most common cause of a silently low Event Match Quality score: nothing errors, the
 * events arrive, and the attribution is simply worse than it should be.
 *
 * Reference: Meta Conversions API "Customer Information Parameters".
 */

const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

/** Undefined for empty input — never hash "" and send it; an empty hash is a fake match signal. */
const hashed = (v: string | null | undefined, normalise: (s: string) => string): string | undefined => {
  if (!v) return undefined;
  const n = normalise(String(v));
  return n ? sha256(n) : undefined;
};

export const hashEmail = (v?: string | null) => hashed(v, (s) => s.trim().toLowerCase());

/**
 * Phone: digits only, country code included, no `+` and no leading zeros.
 *
 * The Qatar rule matters here. Shoppers type a local 8-digit number (`33445566`) far more often
 * than an international one, and hashing 8 digits produces a hash Meta can never match against
 * its own `97433445566`. So a bare 8-digit number gets the 974 prefix. A number that already
 * starts 974, or is longer, is left alone — a Saudi or Emirati customer must not be mangled.
 */
export const hashPhone = (v?: string | null) =>
  hashed(v, (s) => {
    let d = s.replace(/\D/g, "").replace(/^0+/, "");
    if (d.length === 8) d = `974${d}`;
    return d;
  });

/**
 * Names: trimmed, lowercased, whitespace collapsed.
 *
 * Deliberately NOT stripped to `[a-z]`. Meta accepts UTF-8 and this store's customers are largely
 * Arabic-speaking — an `[^a-z]` filter would reduce "فاطمة" to an empty string and silently drop
 * the field for exactly the audience that matters most.
 */
const normaliseName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const hashName = (v?: string | null) => hashed(v, normaliseName);

/** City: lowercase, and spaces removed entirely per Meta's spec ("new york" -> "newyork"). */
export const hashCity = (v?: string | null) => hashed(v, (s) => s.trim().toLowerCase().replace(/\s+/g, ""));

/**
 * Country: ISO 3166-1 alpha-2, lowercased. Shoppers type a name ("Qatar"), not a code, and the
 * checkout field defaults to "Qatar" — so map the ones this store actually sees and pass through
 * anything that already looks like a code.
 */
const COUNTRY_CODES: Record<string, string> = {
  qatar: "qa",
  "state of qatar": "qa",
  قطر: "qa",
  "saudi arabia": "sa",
  "united arab emirates": "ae",
  uae: "ae",
  kuwait: "kw",
  bahrain: "bh",
  oman: "om",
};
export const hashCountry = (v?: string | null) =>
  hashed(v, (s) => {
    const t = s.trim().toLowerCase();
    if (COUNTRY_CODES[t]) return COUNTRY_CODES[t];
    return /^[a-z]{2}$/.test(t) ? t : "";
  });

/** external_id is an opaque stable id; Meta wants it hashed like the rest. */
export const hashExternalId = (v?: string | null) => hashed(v, (s) => s.trim());

/**
 * Split a single stored name into first/last.
 *
 * lib/actions/checkout.ts already does exactly this to build the SkipCash payment request. This
 * is that logic extracted rather than copied: two independent copies would drift, and Meta and
 * SkipCash would end up holding different names for the same human.
 */
export function splitFullName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const [firstName = "", ...rest] = String(fullName ?? "").trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || firstName };
}
