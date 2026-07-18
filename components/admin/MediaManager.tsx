"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { Button, Panel, SectionLabel } from "./ui";

const input = "flex-1 border border-edge bg-canvas px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-faint focus:border-accent/60";

function VideoField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/admin/media", { method: "POST", body: fd });
      if (!r.ok) {
        toast.error((await r.json().catch(() => ({}))).error ?? "Upload failed");
        return;
      }
      const { url } = await r.json();
      onChange(url);
      toast.success("Video uploaded");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste a video URL (https://…) or /assets/video/…"
          className={input}
        />
        <label className="inline-flex cursor-pointer items-center gap-1.5 border border-edge bg-elevated px-3 py-2 text-[13px] text-foreground hover:border-accent/60">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {value && (
        <video key={value} src={value} muted controls playsInline className="mt-1 max-h-56 w-full border border-edge bg-black/20 object-contain" />
      )}
    </div>
  );
}

export function MediaManager({ initial }: { initial: Record<string, string> }) {
  const [data, setData] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (v: string) => setData((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/content/home", { method: "PUT", body: JSON.stringify(data) });
      if (r.ok) toast.success("Videos saved — live on the storefront");
      else toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="space-y-6 p-5">
      <VideoField label="Hero video (top of homepage)" value={data.heroVideo ?? ""} onChange={set("heroVideo")} />
      <p className="text-[11px] leading-relaxed text-faint">
        Paste a hosted URL (e.g. a CDN/Cloudflare/S3 <code>.mp4</code> link) or upload a file. Very large uploads may hit
        local storage limits — for big videos, host them and paste the URL. Changes go live immediately after saving.
      </p>
      <div className="flex justify-end">
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save videos"}</Button>
      </div>
    </Panel>
  );
}
