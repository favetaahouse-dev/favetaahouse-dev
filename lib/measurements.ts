/**
 * The made-to-order measurement schema and the one validator both sides run.
 *
 * No `server-only`: like lib/variant-options.ts this is imported by the storefront form, the
 * cart server action, the checkout action, the receipt renderer and the admin — and the whole
 * point is that they agree. The field LIST is owner-editable (Admin → Content → Made to Order)
 * and stored in the CMS, so it is data, not code.
 *
 * UNITS. min/max are always centimetres, because a range has to be expressed in something and
 * the atelier works in cm. The customer may type inches; validation converts before comparing.
 * What gets STORED is exactly what they typed, alongside the unit they typed it in — an
 * in→cm→in round trip would show the tailor 58.1" for a garment somebody ordered at 58".
 */

export type MeasureField = {
  key: string;
  label: string;
  labelAr: string;
  /**
   * Inclusive bounds in centimetres, and OPTIONAL: 0 on either side means "no limit there".
   *
   * Unbounded by default on purpose. A range that rejects a real customer costs a sale, and the
   * garment is cut by a person who will notice a 12 cm bust long before it reaches a cutting
   * table. The mechanism stays so the owner can re-impose a limit per field from
   * Admin -> Content -> Made to Order, but nothing is enforced unless they ask for it.
   */
  min: number;
  max: number;
  required: boolean;
};

/** Whether a field constrains anything at all — 0 on both sides means it does not. */
export const hasBounds = (f: { min: number; max: number }) => f.min > 0 || f.max > 0;

export type Unit = "cm" | "in";
export type Measurements = Record<string, number>;

export const UNITS: readonly Unit[] = ["cm", "in"] as const;
export const CM_PER_INCH = 2.54;
/** Bounds the free-text note a customer can attach to a made-to-order line. */
export const MAX_NOTES = 500;
/**
 * Made-to-order has no stock to cap quantity against, so it needs a cap of its own — otherwise
 * the quantity box is unbounded on exactly the lines that cost the atelier the most work.
 */
export const MAX_MTO_QTY = 10;

export function isUnit(v: unknown): v is Unit {
  return v === "cm" || v === "in";
}

/** One decimal is the finest a tape measure is read to, in either unit. */
export function roundMeasure(n: number): number {
  return Math.round(n * 10) / 10;
}

export function toCm(value: number, unit: Unit): number {
  return unit === "in" ? value * CM_PER_INCH : value;
}

export function fromCm(value: number, unit: Unit): number {
  return unit === "in" ? value / CM_PER_INCH : value;
}

/**
 * A field's bounds expressed in the unit the shopper is currently typing in.
 *
 * Takes the bounds rather than a whole MeasureField: the storefront hands this a DTO whose
 * bilingual labels have already been resolved away server-side, and it has no business
 * re-acquiring them just to read two numbers.
 */
export function fieldRange(f: { min: number; max: number }, unit: Unit): { min: number; max: number } {
  return { min: roundMeasure(fromCm(f.min, unit)), max: roundMeasure(fromCm(f.max, unit)) };
}

/** The label for a locale, falling back to English when no Arabic has been entered. */
export function fieldLabel(f: MeasureField, locale?: string): string {
  return locale === "ar" && f.labelAr ? f.labelAr : f.label;
}

/**
 * The house default, seeded into the CMS by lib/content-schema.ts. An abaya, a jalabiya and a
 * sheila are cut from different subsets of these, which is what products.mto_fields selects.
 */
export const DEFAULT_MEASURE_FIELDS: MeasureField[] = [
  { key: "shoulder", label: "Shoulder", labelAr: "الكتف", min: 0, max: 0, required: true },
  { key: "bust", label: "Bust", labelAr: "الصدر", min: 0, max: 0, required: true },
  { key: "waist", label: "Waist", labelAr: "الخصر", min: 0, max: 0, required: true },
  { key: "hips", label: "Hips", labelAr: "الأرداف", min: 0, max: 0, required: true },
  { key: "sleeveLength", label: "Sleeve length", labelAr: "طول الكم", min: 0, max: 0, required: true },
  { key: "armhole", label: "Armhole", labelAr: "فتحة الإبط", min: 0, max: 0, required: false },
  { key: "wristWidth", label: "Wrist width", labelAr: "محيط المعصم", min: 0, max: 0, required: false },
  { key: "totalLength", label: "Total length", labelAr: "الطول الكلي", min: 0, max: 0, required: true },
  { key: "height", label: "Height", labelAr: "الطول", min: 0, max: 0, required: false },
];

/**
 * Stored as a JSON string inside the CMS's flat Record<string, string>, the same accommodation
 * home.gallery makes by newline-joining its URLs. Keeping the content row's value type uniform
 * is worth more than the structure being legible in the database.
 *
 * Never throws. A hand-mangled blob falls back to the house default rather than taking the
 * product page down — the field list is presentation, and an empty measurement form is a far
 * worse failure than a stale one.
 */
export function parseMeasureFields(raw: string | null | undefined): MeasureField[] {
  if (!raw || !raw.trim()) return DEFAULT_MEASURE_FIELDS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_MEASURE_FIELDS;
    const out: MeasureField[] = [];
    const seen = new Set<string>();
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const key = String(r.key ?? "").trim();
      const label = String(r.label ?? "").trim();
      if (!key || !label || seen.has(key)) continue;
      const min = Number(r.min);
      const max = Number(r.max);
      seen.add(key);
      out.push({
        key,
        label,
        labelAr: String(r.labelAr ?? "").trim(),
        // 0 on either side means unbounded, so it must survive the parse rather than being
        // coerced into an arbitrary ceiling.
        min: Number.isFinite(min) && min > 0 ? min : 0,
        max: Number.isFinite(max) && max > 0 ? max : 0,
        required: r.required !== false,
      });
    }
    return out.length ? out : DEFAULT_MEASURE_FIELDS;
  } catch {
    return DEFAULT_MEASURE_FIELDS;
  }
}

export function serializeMeasureFields(fields: MeasureField[]): string {
  return JSON.stringify(
    fields.map((f) => ({
      key: f.key.trim(),
      label: f.label.trim(),
      labelAr: f.labelAr.trim(),
      min: f.min,
      max: f.max,
      required: f.required,
    })),
  );
}

/**
 * Narrow the house-wide list to the fields a given product actually needs.
 * An empty `keys` means "all of them" — the column default, so a product nobody has configured
 * still asks for a complete set rather than nothing.
 */
export function applicableFields(all: MeasureField[], keys: string[] | null | undefined): MeasureField[] {
  if (!keys?.length) return all;
  const want = new Set(keys);
  const picked = all.filter((f) => want.has(f.key));
  return picked.length ? picked : all;
}

/** "between 25 and 70 cm" / "at least 25 cm" / "at most 70 cm", depending on which sides are set. */
export function boundText(f: MeasureField, unit: Unit): string {
  const r = fieldRange(f, unit);
  if (f.min > 0 && f.max > 0) return `between ${r.min} and ${r.max} ${unit}`;
  if (f.min > 0) return `at least ${r.min} ${unit}`;
  return `at most ${r.max} ${unit}`;
}

export type MeasureResult =
  | { ok: true; clean: Measurements }
  | { ok: false; error: string; key?: string };

/**
 * The enforcement point. The PDP mirrors these rules for instant feedback, but server actions
 * are public endpoints — the browser's version of this is a courtesy, not a gate.
 *
 * Unknown keys are rejected rather than dropped: a key the field list doesn't describe reaches
 * the atelier as an unlabelled number, which is worse than a refused add-to-cart.
 */
export function validateMeasurements(
  fields: MeasureField[],
  values: unknown,
  unit: Unit,
): MeasureResult {
  if (!fields.length) return { ok: true, clean: {} };
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return { ok: false, error: "Measurements are missing." };
  }
  const input = values as Record<string, unknown>;
  const known = new Set(fields.map((f) => f.key));
  const unknown = Object.keys(input).find((k) => !known.has(k));
  if (unknown) return { ok: false, error: `"${unknown}" is not a measurement on this piece.`, key: unknown };

  const clean: Measurements = {};
  for (const f of fields) {
    const raw = input[f.key];
    const blank = raw === undefined || raw === null || raw === "";
    if (blank) {
      if (f.required) return { ok: false, error: `${f.label} is required.`, key: f.key };
      continue;
    }
    const n = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: `${f.label} must be a number.`, key: f.key };
    }
    const cm = toCm(n, unit);
    // Each side is checked only if it is set. With both at 0 — the default — any positive
    // number is accepted, and the only thing still rejected is a blank required field or a
    // value that is not a number.
    if ((f.min > 0 && cm < f.min) || (f.max > 0 && cm > f.max)) {
      return { ok: false, error: `${f.label} must be ${boundText(f, unit)}.`, key: f.key };
    }
    clean[f.key] = roundMeasure(n);
  }
  return { ok: true, clean };
}

/** Label/value pairs in field order — the shape every renderer wants (cart, receipt, worksheet). */
export function measurementRows(
  fields: MeasureField[],
  values: Measurements | null | undefined,
  locale?: string,
): { key: string; label: string; value: number }[] {
  if (!values) return [];
  return fields
    .filter((f) => typeof values[f.key] === "number")
    .map((f) => ({ key: f.key, label: fieldLabel(f, locale), value: values[f.key] }));
}

/** One-line digest for the cart drawer and order lists: "Shoulder 40 · Bust 92 · Waist 78 cm". */
export function measurementSummary(
  fields: MeasureField[],
  values: Measurements | null | undefined,
  unit: Unit,
  locale?: string,
): string {
  const rows = measurementRows(fields, values, locale);
  if (!rows.length) return "";
  return `${rows.map((r) => `${r.label} ${r.value}`).join(" · ")} ${unit}`;
}

/** Coerce whatever came back from a jsonb column into a Measurements map. */
export function asMeasurements(raw: unknown): Measurements | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Measurements = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}
