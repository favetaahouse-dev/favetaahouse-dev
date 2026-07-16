"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel, SectionLabel } from "@/components/admin/ui";
import { BilingualFieldRow, SaveButton } from "@/components/admin/ContentKit";

export default function AnnouncementsPage() {
  // Hold the whole site-settings blob so a save merges rather than wipes the other fields.
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/content/site-settings")
      .then((r) => r.json())
      .then((d) => { setData(d ?? {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const set = (k: string) => (v: string) => setData((p) => ({ ...p, [k]: v }));

  async function save() {
    const res = await fetch("/api/admin/content/site-settings", { method: "PUT", body: JSON.stringify(data) });
    if (res.ok) toast.success("Announcement saved"); else toast.error("Failed to save");
  }

  const preview = (data.announcement ?? "").trim();

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="The banner shown across the top of the storefront" />

      <Panel className="p-5">
        <SectionLabel className="mb-4">Storefront announcement bar</SectionLabel>
        {loading ? (
          <p className="text-sm text-secondary">Loading…</p>
        ) : (
          <div className="max-w-3xl space-y-5">
            {preview ? (
              <div className="bg-accent px-4 py-2 text-center text-[13px] font-medium text-accent-fg">{preview}</div>
            ) : (
              <div className="border border-dashed border-edge px-4 py-2 text-center text-xs text-faint">
                Bar hidden — no message set
              </div>
            )}
            <BilingualFieldRow
              label="Announcement message"
              en={data.announcement ?? ""}
              ar={data.announcement_ar ?? ""}
              onEn={set("announcement")}
              onAr={set("announcement_ar")}
            />
            <p className="text-[11px] leading-relaxed text-faint">
              Leave both fields empty to hide the bar. Changes appear on the live storefront immediately after saving.
            </p>
            <SaveButton onSave={save} />
          </div>
        )}
      </Panel>
    </div>
  );
}
