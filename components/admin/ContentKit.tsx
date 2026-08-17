"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { parseList } from "@/lib/variant-options";
import { parseMeasureFields, serializeMeasureFields, type MeasureField } from "@/lib/measurements";

export function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-white/10 bg-[#212121]">
      <div className="border-b border-white/10 px-5 py-3">
        <h2 className="font-button text-xs uppercase tracking-[0.16em]">{title}</h2>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full border border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-signal";

export function FieldRow({
  label,
  value,
  onChange,
  textarea,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</span>
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-white/30">{hint}</span>}
    </label>
  );
}

export function NumberFieldRow({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-white/30">{hint}</span>}
    </label>
  );
}

export function ToggleFieldRow({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const on = value !== "false";
  return (
    <div>
      <button type="button" onClick={() => onChange(on ? "false" : "true")} className="flex items-center gap-3">
        <span className={`relative inline-block h-5 w-9 rounded-full transition ${on ? "bg-signal" : "bg-white/20"}`}>
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#141414] transition-all ${on ? "left-[18px]" : "left-0.5"}`}
          />
        </span>
        <span className="text-sm">{label}</span>
      </button>
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-white/30">{hint}</span>}
    </div>
  );
}

/** Edit a comma-joined list as removable chips + an add-input. Stored back as "a, b, c". */
export function ListFieldRow({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const items = parseList(value);
  const commit = (next: string[]) => onChange(next.join(", "));
  const add = (raw: string) => {
    const v = raw.trim();
    if (v && !items.includes(v)) commit([...items, v]);
  };
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</span>
      <div className={`flex flex-wrap items-center gap-1.5 ${inputCls} !h-auto !py-2`}>
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 text-xs">
            {it}
            <button type="button" onClick={() => commit(items.filter((x) => x !== it))} className="text-white/40 hover:text-red-400" aria-label={`Remove ${it}`}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          placeholder="Add + Enter"
          className="flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-white/30"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
      </div>
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-white/30">{hint}</span>}
    </label>
  );
}

export function BilingualFieldRow({
  label,
  en,
  ar,
  onEn,
  onAr,
  textarea,
}: {
  label: string;
  en: string;
  ar: string;
  onEn: (v: string) => void;
  onAr: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</span>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {textarea ? (
          <textarea rows={3} value={en} onChange={(e) => onEn(e.target.value)} placeholder="English" className={inputCls} />
        ) : (
          <input value={en} onChange={(e) => onEn(e.target.value)} placeholder="English" className={inputCls} />
        )}
        {textarea ? (
          <textarea rows={3} value={ar} onChange={(e) => onAr(e.target.value)} placeholder="العربية" dir="rtl" className={inputCls} />
        ) : (
          <input value={ar} onChange={(e) => onAr(e.target.value)} placeholder="العربية" dir="rtl" className={inputCls} />
        )}
      </div>
    </div>
  );
}

/**
 * The made-to-order measurement schema — the only repeatable, structured field in the CMS.
 *
 * Its value is a JSON string, so a content row stays a flat Record<string, string> and
 * getContent's twenty-odd callers keep their types. This component owns the parse/serialize
 * round trip; nothing else needs to know.
 *
 * The machine KEY is shown read-only rather than edited. It is what products.mto_fields, every
 * live cart line and every placed order address a measurement by, so an editable key would
 * silently orphan history. A key is slugified from the English label the first time a row is
 * created and then frozen — renaming the label is safe, and that is the edit an owner actually
 * wants.
 */
export function MeasureFieldsRow({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const fields = parseMeasureFields(value);
  const write = (next: MeasureField[]) => onChange(serializeMeasureFields(next));
  const patch = (i: number, p: Partial<MeasureField>) =>
    write(fields.map((f, n) => (n === i ? { ...f, ...p } : f)));

  function addRow() {
    write([
      ...fields,
      { key: `field_${fields.length + 1}`, label: "", labelAr: "", min: 20, max: 200, required: false },
    ]);
  }

  function relabel(i: number, text: string) {
    const f = fields[i];
    // Freeze the key the moment the row has a real one. Only a row that has never been named
    // gets its key regenerated, which is what makes renaming a label non-destructive.
    const provisional = /^field_\d+$/.test(f.key);
    const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const taken = new Set(fields.filter((_, n) => n !== i).map((x) => x.key));
    const key = provisional && slug && !taken.has(slug) ? slug : f.key;
    patch(i, { label: text, key });
  }

  return (
    <div className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</span>
      <div className="space-y-2">
        {fields.map((f, i) => (
          <div key={f.key} className="flex flex-wrap items-center gap-2 border border-white/10 p-2">
            <input
              value={f.label}
              onChange={(e) => relabel(i, e.target.value)}
              placeholder="English label"
              className={`${inputCls} min-w-[9rem] flex-1`}
            />
            <input
              value={f.labelAr}
              onChange={(e) => patch(i, { labelAr: e.target.value })}
              placeholder="العربية"
              dir="rtl"
              lang="ar"
              className={`${inputCls} min-w-[9rem] flex-1`}
            />
            <input
              type="number"
              value={f.min}
              onChange={(e) => patch(i, { min: Number(e.target.value) })}
              aria-label={`${f.label || "Field"} minimum in cm`}
              className={`${inputCls} w-20`}
            />
            <span className="text-[11px] text-white/30">–</span>
            <input
              type="number"
              value={f.max}
              onChange={(e) => patch(i, { max: Number(e.target.value) })}
              aria-label={`${f.label || "Field"} maximum in cm`}
              className={`${inputCls} w-20`}
            />
            <span className="text-[11px] text-white/30">cm</span>
            <label className="flex items-center gap-1.5 text-[11px] text-white/50">
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => patch(i, { required: e.target.checked })}
              />
              Required
            </label>
            <code className="text-[10px] text-white/25">{f.key}</code>
            <button
              type="button"
              onClick={() => write(fields.filter((_, n) => n !== i))}
              aria-label={`Remove ${f.label || "field"}`}
              className="ms-auto p-1 text-white/40 transition-colors hover:text-signal"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 border border-white/15 px-3 py-1.5 text-xs transition-colors hover:border-signal"
      >
        Add measurement
      </button>
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-white/30">{hint}</span>}
    </div>
  );
}

export function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  return (
    <button
      onClick={async () => {
        setState("saving");
        await onSave();
        setState("saved");
        setTimeout(() => setState("idle"), 1800);
      }}
      disabled={state === "saving"}
      className="flex items-center gap-2 bg-signal px-6 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-white hover:opacity-90 disabled:opacity-60"
    >
      {state === "saving" && <Loader2 size={14} className="animate-spin" />}
      {state === "saved" && <Check size={14} />}
      {state === "saved" ? "Saved" : "Save changes"}
    </button>
  );
}
