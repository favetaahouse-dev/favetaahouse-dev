/**
 * Made-to-order measurement DATA, and the made-to-order quantity cap.
 *
 * Made-to-order used to ask the shopper to type body measurements; it now uses the same size and
 * length chips as ready-to-wear. Nothing collects measurements any more, but orders placed
 * through that form carry them for as long as the orders exist, so the pieces that READ them
 * stay: the jsonb coercion the order and cart layers use, and the field list that labels them
 * on the admin order page, the receipt and the emails.
 *
 * No `server-only`: imported by the cart and order layers, the receipt renderer and the admin
 * content editor alike.
 */

export type MeasureField = {
  key: string;
  label: string;
  labelAr: string;
  /** Inclusive bounds in centimetres; 0 on either side means "no limit there". */
  min: number;
  max: number;
  required: boolean;
};

export type Unit = "cm" | "in";
export type Measurements = Record<string, number>;

/**
 * Made-to-order has no stock to cap quantity against, so it needs a cap of its own — otherwise
 * the quantity box is unbounded on exactly the lines that cost the atelier the most work.
 */
export const MAX_MTO_QTY = 10;

export function isUnit(v: unknown): v is Unit {
  return v === "cm" || v === "in";
}

/** The house list the old form asked for, still the labels for any order placed through it. */
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
 * Never throws. A hand-mangled blob falls back to the house default rather than taking a page
 * down — the field list is presentation, and missing labels are a far worse failure than stale
 * ones.
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
