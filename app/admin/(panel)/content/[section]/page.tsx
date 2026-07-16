"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import {
  ContentSection,
  FieldRow,
  BilingualFieldRow,
  NumberFieldRow,
  ToggleFieldRow,
  SaveButton,
} from "@/components/admin/ContentKit";
import { FIELD_SCHEMA, SECTION_TITLES, SECTIONS, type Section } from "@/lib/content-schema";

export default function ContentEditor({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  const sec = section as Section;
  const valid = (SECTIONS as readonly string[]).includes(section);

  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!valid) return;
    fetch(`/api/admin/content/${sec}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [sec, valid]);

  if (!valid) return notFound();

  const set = (k: string) => (v: string) => setData((p) => ({ ...p, [k]: v }));

  async function save() {
    const res = await fetch(`/api/admin/content/${sec}`, { method: "PUT", body: JSON.stringify(data) });
    if (res.ok) toast.success("Content saved"); else toast.error("Failed to save");
  }

  if (loading) return <p className="text-white/40">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <ContentSection title={SECTION_TITLES[sec]}>
        {FIELD_SCHEMA[sec].map((f) => {
          if (f.kind === "bi" || f.kind === "bitext") {
            return (
              <BilingualFieldRow
                key={f.key}
                label={f.label}
                en={data[f.key] ?? ""}
                ar={data[`${f.key}_ar`] ?? ""}
                onEn={set(f.key)}
                onAr={set(`${f.key}_ar`)}
                textarea={f.kind === "bitext"}
              />
            );
          }
          if (f.kind === "number") {
            return <NumberFieldRow key={f.key} label={f.label} value={data[f.key] ?? ""} onChange={set(f.key)} hint={f.hint} />;
          }
          if (f.kind === "toggle") {
            return <ToggleFieldRow key={f.key} label={f.label} value={data[f.key] ?? ""} onChange={set(f.key)} hint={f.hint} />;
          }
          return (
            <FieldRow key={f.key} label={f.label} value={data[f.key] ?? ""} onChange={set(f.key)} textarea={f.kind === "textarea"} />
          );
        })}
      </ContentSection>
      <SaveButton onSave={save} />
    </div>
  );
}
