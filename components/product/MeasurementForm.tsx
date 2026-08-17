"use client";

import { useTranslations } from "next-intl";
import { fieldRange, fromCm, hasBounds, roundMeasure, toCm, UNITS, type Unit } from "@/lib/measurements";
import { cn } from "@/lib/utils";

/** Localised server-side, so the client never receives the bilingual blob. */
export type MeasureFieldDTO = {
  key: string;
  label: string;
  /** Bounds in centimetres — fieldRange converts them for display. */
  min: number;
  max: number;
  required: boolean;
};

type Props = {
  fields: MeasureFieldDTO[];
  unit: Unit;
  onUnitChange: (u: Unit) => void;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  errors: Record<string, string>;
  intro: string;
  notesLabel: string;
  notes: string;
  onNotesChange: (v: string) => void;
  maxNotes: number;
};

const chip = "focus-ring min-w-11 border px-4 py-2.5 text-[13px] transition-colors";
const chipOn = "border-strong bg-strong text-white";
const chipOff = "border-line hover:border-strong";

/**
 * The made-to-order measurement form.
 *
 * Extracted from ProductDetail rather than inlined: that component was already 415 lines of
 * buying controls, and this is the one part of the page with its own validation, its own unit
 * arithmetic and its own RTL rules.
 *
 * INLINE, not a drawer. The buying column is a 340–420px panel at xl and full width below it,
 * which fits a two-column numeric grid; and a drawer would hide the price and the Add button, so
 * a rejected measurement would cost the shopper a re-open to see why. It also keeps the page
 * free of a second overlay to layer against the sticky buy bar and the lightbox.
 */
export function MeasurementForm({
  fields, unit, onUnitChange, values, onChange, errors,
  intro, notesLabel, notes, onNotesChange, maxNotes,
}: Props) {
  const t = useTranslations("product");

  /**
   * Switching unit CONVERTS what has been typed rather than clearing it — the shopper who
   * realises halfway through that they measured in inches should not start again. Only possible
   * because the bounds are held in one canonical unit (cm) and converted for display.
   */
  function switchUnit(next: Unit) {
    if (next === unit) return;
    const converted: Record<string, string> = {};
    for (const [k, raw] of Object.entries(values)) {
      const n = Number(raw);
      converted[k] = raw === "" || !Number.isFinite(n) ? raw : String(roundMeasure(fromCm(toCm(n, unit), next)));
    }
    onChange(converted);
    onUnitChange(next);
  }

  return (
    <div className="mt-7 border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-button text-[13px] font-medium text-strong">{t("yourMeasurements")}</p>
        <div className="flex gap-1.5" role="group" aria-label={t("unit")}>
          {UNITS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => switchUnit(u)}
              aria-pressed={unit === u}
              className={cn(chip, "min-w-0 px-3 py-1.5 text-[12px]", unit === u ? chipOn : chipOff)}
            >
              {u === "cm" ? t("unitCm") : t("unitIn")}
            </button>
          ))}
        </div>
      </div>

      {intro && <p className="mt-2 text-[13px] text-muted">{intro}</p>}

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
        {fields.map((f) => {
          const r = fieldRange(f, unit);
          const bounded = hasBounds(f);
          const err = errors[f.key];
          return (
            <div key={f.key}>
              <label htmlFor={`m-${f.key}`} className="mb-1.5 block text-[12px] text-ink">
                {f.label}
                {f.required && <span aria-hidden className="text-muted"> *</span>}
              </label>
              <div className="relative">
                {/*
                  dir="ltr" on the input itself, not inherited from the page. Numbers render
                  left-to-right inside an RTL block anyway, but a PARTIALLY typed value — "41."
                  — moves the caret unpredictably without an explicit direction here. text-start
                  keeps the digits against the reading edge in both directions.
                */}
                <input
                  id={`m-${f.key}`}
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
                  aria-invalid={!!err}
                  aria-describedby={err ? `m-${f.key}-err` : undefined}
                  // A hint only when there is something to hint at. Fields are unbounded by
                  // default, and "0–0" would read as a rule rather than the absence of one.
                  placeholder={
                    bounded ? (f.min > 0 && f.max > 0 ? `${r.min}–${r.max}` : f.min > 0 ? `≥ ${r.min}` : `≤ ${r.max}`) : ""
                  }
                  className={cn(
                    "focus-ring w-full border bg-card px-3 py-2.5 pe-10 text-start text-[13px]",
                    err ? "border-signal" : "border-line",
                  )}
                />
                {/*
                  A sibling span, not a placeholder and not inside the input: put inside, the
                  unit joins the number's bidi run and the two reorder on /ar.
                */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-muted"
                >
                  {unit}
                </span>
              </div>
              {err && (
                <p id={`m-${f.key}-err`} role="alert" className="mt-1 text-[11px] text-signal">
                  {err}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <label htmlFor="m-notes" className="mb-1.5 block text-[12px] text-ink">
          {notesLabel || t("notes")}
        </label>
        <textarea
          id="m-notes"
          rows={2}
          maxLength={maxNotes}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={t("notesPlaceholder")}
          className="focus-ring w-full border border-line bg-card px-3 py-2.5 text-[13px]"
        />
      </div>
    </div>
  );
}
