"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

export function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-white/10 bg-[#222320]">
      <div className="border-b border-white/10 px-5 py-3">
        <h2 className="font-button text-xs uppercase tracking-[0.16em]">{title}</h2>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full border border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold";

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
        <span className={`relative inline-block h-5 w-9 rounded-full transition ${on ? "bg-gold" : "bg-white/20"}`}>
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#1b1a18] transition-all ${on ? "left-[18px]" : "left-0.5"}`}
          />
        </span>
        <span className="text-sm">{label}</span>
      </button>
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-white/30">{hint}</span>}
    </div>
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
      className="flex items-center gap-2 bg-gold px-6 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-[#1b1a18] hover:opacity-90 disabled:opacity-60"
    >
      {state === "saving" && <Loader2 size={14} className="animate-spin" />}
      {state === "saved" && <Check size={14} />}
      {state === "saved" ? "Saved" : "Save changes"}
    </button>
  );
}
