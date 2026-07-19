"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react";
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

/**
 * Homepage gallery editor. The images live as a newline-joined string in the same "home"
 * content blob as the hero video (value/onChange come from the parent's blob state), so one
 * "Save" persists both. Uploads reuse the shared /api/admin/media endpoint; URLs can also be
 * pasted. Plain <img> because gallery URLs may point at arbitrary hosts.
 */
function GalleryField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const images = value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const commit = (next: string[]) => onChange(next.join("\n"));
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
      const { url: uploaded } = await r.json();
      commit([...images, uploaded]);
      toast.success("Image added");
    } finally {
      setBusy(false);
    }
  };

  const addUrl = () => {
    const v = url.trim();
    if (v) commit([...images, v]);
    setUrl("");
  };
  const removeAt = (i: number) => commit(images.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  return (
    <div className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="group relative aspect-[3/4] overflow-hidden border border-edge bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover object-top" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remove image"
              className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X size={12} />
            </button>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" className="text-white/80 hover:text-accent disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] text-white/60">{i + 1}</span>
              <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Move later" className="text-white/80 hover:text-accent disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-1 border border-dashed border-edge text-faint hover:border-accent hover:text-accent"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          <span className="text-[10px] uppercase tracking-wider">Upload</span>
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="…or paste an image URL (https://…)"
          className={input}
        />
        <Button variant="default" onClick={addUrl} disabled={!url.trim()}>Add URL</Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
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
      if (r.ok) toast.success("Saved — live on the storefront");
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

      <div className="border-t border-edge pt-6">
        <GalleryField label="Homepage gallery images" value={data.gallery ?? ""} onChange={set("gallery")} />
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          Shown in the “Gallery” section of the homepage. Upload or paste image URLs, drag order with the arrows, and
          remove with ✕. Leaving it empty hides the whole gallery section.
        </p>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </Panel>
  );
}
