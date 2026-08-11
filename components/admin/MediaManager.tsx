"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, X, Trash2 } from "lucide-react";
import { Button, Panel, SectionLabel, fieldInput } from "./ui";
import { cn } from "@/lib/utils";

const input = cn(fieldInput, "flex-1");

const MB = 1024 * 1024;

/**
 * Not every failing response is JSON. A 413 from Vercel's edge is a plain-text error page, so
 * `r.json()` throws on it — which is exactly how "your file is too large" used to reach the user
 * as a bare "Upload failed" with nothing to act on.
 */
async function reasonFor(r: Response, fallback: string): Promise<string> {
  const body = await r.text().catch(() => "");
  try {
    const parsed = JSON.parse(body);
    if (parsed?.error) return String(parsed.error);
  } catch {}
  if (r.status === 413) return "File too large for the server — host it and paste the URL instead";
  return body.trim().slice(0, 140) || `${fallback} (HTTP ${r.status})`;
}

/**
 * Shared by every field here. Two steps, and the file itself never touches our own server:
 * /api/admin/media authorises the upload and returns a URL signed for one object, then the
 * browser PUTs the bytes straight to Supabase Storage. Vercel only ever sees a few hundred bytes
 * of JSON, so the platform's 4.5 MB function body limit stops applying to the upload.
 */
async function uploadMedia(file: File): Promise<string | null> {
  const signed = await fetch("/api/admin/media", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: file.name, type: file.type }),
  });
  if (!signed.ok) {
    toast.error(await reasonFor(signed, "Could not start the upload"));
    return null;
  }
  const { uploadUrl, publicUrl, contentType } = await signed.json();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    // A year is safe: the object key carries a timestamp, so a replacement is a new URL.
    headers: { "content-type": contentType, "cache-control": "max-age=31536000" },
    body: file,
  });
  if (!put.ok) {
    toast.error(await reasonFor(put, "Upload failed"));
    return null;
  }
  return publicUrl as string;
}

/**
 * Take a file back out of Storage. Best-effort by design: the CMS field has already been cleared
 * and saved by the time this runs, so a failure here leaves an invisible orphan rather than a
 * storefront pointing at an object that no longer exists. Never throws, never toasts — a cleanup
 * error is not something the owner can act on.
 */
async function deleteMedia(url: string): Promise<void> {
  if (!url) return;
  try {
    await fetch("/api/admin/media", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {}
}

/** Resolve on `type`, reject on error or when `ms` elapses — used to await one media event. */
function settled(el: HTMLVideoElement, type: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (fn: () => void) => () => {
      clearTimeout(timer);
      el.removeEventListener(type, ok);
      el.removeEventListener("error", fail);
      fn();
    };
    const ok = done(resolve);
    const fail = done(() => reject(new Error("could not be read as video")));
    const timer = setTimeout(done(() => reject(new Error("took too long to read"))), ms);
    el.addEventListener(type, ok);
    el.addEventListener("error", fail);
  });
}

type Probe = {
  width: number;
  height: number;
  seconds: number;
  /** null where the engine has no way to tell — treated as "don't know", not "no". */
  hasAudio: boolean | null;
  /**
   * An early frame's mean colour as #rrggbb, or null if this browser could decode metadata but
   * not pixels. It is the entire floor under the hero — there is no poster still — so a null here
   * means the homepage falls back to a neutral grey.
   */
  bg: string | null;
};

/** Longest a still frame is worth waiting for before calling the file unreadable. */
const PROBE_TIMEOUT_MS = 20_000;

/**
 * Read the video in the browser, once, for everything the hero needs to know about it:
 *
 *   - what a phone will have to decode and buffer (dimensions, bytes, duration)
 *   - whether it carries an audio track — WebKit lets a SILENT <video> autoplay in cases where it
 *     refuses a muted-but-audio-bearing one (webkit.org/blog/6784), so this is a real hero killer
 *   - the mean colour of an early frame
 *
 * Measuring the colour here rather than asking the owner for one is what stops the two drifting
 * apart: the floor can never be sampled from footage that is no longer playing. It doubles as the
 * honest compatibility test, too — if the browser cannot decode a frame of this file, neither can
 * a visitor's, and the owner finds out at upload time instead of from a black homepage.
 *
 * Frame 0 is deliberately skipped: a clip that opens on a fade or a black leader would average to
 * black, which is the exact colour this hero must never show.
 */
async function probeVideo(file: File): Promise<Probe> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "auto";
  v.muted = true;
  v.playsInline = true;
  // No crossOrigin: a blob: URL is same-origin, so the canvas below is never tainted.
  v.src = url;

  try {
    await settled(v, "loadeddata", PROBE_TIMEOUT_MS);

    const probe = v as HTMLVideoElement & {
      mozHasAudio?: boolean;
      audioTracks?: { length: number };
      webkitAudioDecodedByteCount?: number;
    };
    const hasAudio =
      typeof probe.mozHasAudio === "boolean"
        ? probe.mozHasAudio
        : probe.audioTracks
          ? probe.audioTracks.length > 0
          : (probe.webkitAudioDecodedByteCount ?? 0) > 0
            ? true
            : null;

    // A tenth of a second in, or a tenth of the way through a very short clip. `seeked` may not
    // fire if the element is already there, so a timeout just means "draw what you have".
    const target = Math.min(0.1, (Number.isFinite(v.duration) ? v.duration : 1) / 10);
    if (target > 0) {
      v.currentTime = target;
      await settled(v, "seeked", 5_000).catch(() => {});
    }

    // A frame that will not rasterise still leaves a usable video; the hero just falls back to its
    // neutral floor colour. Not worth failing the upload over — meanColour swallows its own errors.
    const bg = meanColour(v);

    return { width: v.videoWidth, height: v.videoHeight, seconds: v.duration, hasAudio, bg };
  } finally {
    // Detach before revoking, or the element keeps requesting a URL that no longer resolves.
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Squash the frame to a single pixel and read it — the cheapest honest average there is, and the
 * only pixel work left now that no poster JPEG is encoded. Drawing the <video> straight into the
 * 1×1 canvas still exercises a full decode, so it remains the compatibility test described above.
 */
function meanColour(source: HTMLVideoElement): string | null {
  try {
    const one = document.createElement("canvas");
    one.width = one.height = 1;
    const ctx = one.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return null;
  }
}

/**
 * One hero video slot. Upload, replace, remove — and it saves itself the moment any of those
 * finish. There is no separate "Save changes" step for the hero and no paste-a-URL box: a hero
 * that is uploaded but not saved is a state this panel kept ending up in, and every hero problem
 * this site has had came from a link to a file nobody had measured.
 */
function HeroVideoSlot({
  label,
  hint,
  value,
  busy,
  locked,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  value: string;
  /** This slot is the one working — show the spinner here. */
  busy: boolean;
  /** Some hero slot is working. Both lock, because each save PUTs the whole content blob and
   *  two in flight at once would have the second overwrite the first with pre-upload state. */
  locked: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <p className="text-[11px] text-faint">{hint}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p
          className="flex-1 truncate border border-edge bg-canvas px-3 py-2 text-[13px] text-faint"
          title={value || undefined}
        >
          {value ? decodeURIComponent(value.split("/").pop() || value) : "No video set"}
        </p>
        <label
          className={
            locked
              ? "inline-flex items-center gap-1.5 border border-edge bg-elevated px-3 py-2 text-[13px] text-faint opacity-60"
              : "inline-flex cursor-pointer items-center gap-1.5 border border-edge bg-elevated px-3 py-2 text-[13px] text-foreground hover:border-accent/60"
          }
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={locked}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              // Cleared so re-picking the same file still fires a change event.
              e.target.value = "";
            }}
          />
        </label>
        {value && (
          <Button variant="danger" onClick={onRemove} disabled={locked}>
            <Trash2 size={14} /> Remove
          </Button>
        )}
      </div>
      {value && (
        // `key` forces a fresh element on replace: a <video> keeps showing the old frame if only
        // its src attribute changes.
        <video
          key={value}
          src={value}
          muted
          controls
          playsInline
          preload="metadata"
          className="mt-1 max-h-56 w-full border border-edge bg-black/20 object-contain"
        />
      )}
      <p className="text-[11px] text-faint">
        Upload it at full quality — any resolution, up to {MAX_UPLOAD_BYTES / MB} MB. Nothing here
        re-encodes or shrinks your file; the exact bytes you pick are what visitors receive.
      </p>
    </div>
  );
}

/**
 * The homepage story band's photograph — a single image held as a plain URL in the "home"
 * content blob (value/onChange come from the parent's blob state), so one "Save" persists it
 * alongside the hero fields.
 *
 * Upload or paste: uploads reuse the shared media endpoint, and a pasted URL is accepted
 * as-is because the field may legitimately point at a host we do not control. Plain <img>
 * for exactly that reason — next/image would need the host allow-listed to render it.
 */
function StoryImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const uploaded = await uploadMedia(file);
      if (uploaded) {
        onChange(uploaded);
        toast.success("Image updated");
      }
    } finally {
      setBusy(false);
    }
  };

  const addUrl = () => {
    const v = url.trim();
    if (v) onChange(v);
    setUrl("");
  };

  return (
    <div className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap items-start gap-3">
        {value ? (
          <div className="group relative aspect-[4/3] w-48 overflow-hidden border border-edge bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Remove image"
              className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X size={12} />
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex aspect-[4/3] w-48 flex-col items-center justify-center gap-1 border border-dashed border-edge text-faint hover:border-accent hover:text-accent"
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
        <Button variant="default" onClick={addUrl} disabled={!url.trim()}>Use URL</Button>
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

/** Every field that can hold a Storage URL — checked before deleting, so a file two fields share
 *  is never pulled out from under the one still using it. */
const HERO_URL_FIELDS = ["heroVideo", "heroVideoMobile"] as const;

type HeroSlot = "heroVideo" | "heroVideoMobile";

/**
 * The hard ceiling — Storage's, not ours. The browser PUTs straight to Supabase (see uploadMedia),
 * so neither this app nor Vercel's 4.5 MB body limit is anywhere in the path.
 *
 * Measured against the live project rather than assumed: 50 MB uploads in ~3s, 100 MB comes back
 * "The object exceeded the maximum allowed size". It is a Supabase PROJECT setting (Storage →
 * Settings → Upload file size limit) and the bucket itself sets no limit of its own, so lifting it
 * is a dashboard change on a plan that allows more — never a code change here.
 *
 * There is deliberately no advisory below this. The hero is the brand's first impression and the
 * owner's standing instruction is full quality at full resolution; a panel that pesters about
 * every megabyte of a decision already made is noise, not help. What actually costs a phone its
 * first load is the moov atom sitting at the end of the file, and no byte count can detect that.
 */
const MAX_UPLOAD_BYTES = 50 * MB;

export function MediaManager({ initial }: { initial: Record<string, string> }) {
  const [data, setData] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  /** Which hero slot is mid-flight, so only that row shows a spinner. */
  const [busy, setBusy] = useState<HeroSlot | null>(null);
  const set = (k: string) => (v: string) => setData((p) => ({ ...p, [k]: v }));

  /**
   * PUT an explicit blob rather than reading `data` out of the closure: an upload that finishes
   * right after setData would otherwise persist the state from before its own change.
   *
   * This PUT is also the only thing that calls revalidateTag("content") — content is cached with
   * cacheLife("days"), so a write that skips this route stays invisible on the storefront.
   */
  const persist = async (next: Record<string, string>): Promise<boolean> => {
    setData(next);
    setSaving(true);
    try {
      const r = await fetch("/api/admin/content/home", { method: "PUT", body: JSON.stringify(next) });
      if (!r.ok) toast.error(await reasonFor(r, "Failed to save"));
      return r.ok;
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (await persist(data)) toast.success("Saved — live on the storefront");
  };

  /** Drop files the new blob no longer references anywhere. */
  const sweep = (candidates: string[], next: Record<string, string>) => {
    for (const url of candidates) {
      if (url && !HERO_URL_FIELDS.some((f) => (next[f] || "") === url)) void deleteMedia(url);
    }
  };

  /**
   * Upload one cut. The floor colour rides along: the desktop cut always refreshes it, the mobile
   * cut only fills it in when nothing has set one — so the colour under the hero always belongs to
   * the footage the majority of visitors are actually watching.
   */
  const uploadHero = async (slot: HeroSlot, file: File) => {
    setBusy(slot);
    try {
      // Checked before the probe, because this one cannot be talked around: Storage rejects the
      // PUT, so the alternative is spending a 50 MB upload to arrive at the same answer slowly.
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(
          `That file is ${(file.size / MB).toFixed(1)} MB and storage refuses anything over ${MAX_UPLOAD_BYTES / MB} MB. Shorten the clip, or raise the limit in Supabase → Storage → Settings.`,
          { duration: 10_000 },
        );
        return;
      }

      let probe: Probe;
      try {
        probe = await probeVideo(file);
      } catch (e) {
        toast.error(
          `That file ${(e as Error).message}. If this browser cannot read it, your visitors' browsers cannot either — export it as an MP4 (H.264) and try again.`,
        );
        return;
      }

      // Warn, never block — with exactly one exception, above, for the file Storage will refuse
      // outright. Size and resolution are the owner's call and are reported, not complained about;
      // an audio track is not a matter of taste, because it is what stops some phones autoplaying
      // the hero at all.
      const problems: string[] = [];
      if (probe.hasAudio) problems.push("an audio track, which stops some phones autoplaying it");

      const url = await uploadMedia(file);
      if (!url) return;

      const patch: Record<string, string> = { [slot]: url };
      const replaced = [data[slot] || ""];

      const bgNeeded = slot === "heroVideo" || !(data.heroBg || "").trim();
      if (bgNeeded && probe.bg) {
        patch.heroBg = probe.bg;
      } else if (bgNeeded) {
        toast.warning("The video uploaded, but no colour could be read from it — the hero will show a neutral grey until its first frame decodes.");
      }

      const next = { ...data, ...patch };
      if (!(await persist(next))) return;

      // What was actually uploaded, stated plainly. The owner asked for full quality, so these are
      // facts to confirm the export landed intact — not a scolding for the size of it.
      const facts = `${probe.width}×${probe.height}, ${(file.size / MB).toFixed(1)} MB`;
      if (problems.length) {
        toast.warning(`Live (${facts}), but ${problems.join("; ")}.`, { duration: 10_000 });
      } else {
        toast.success(`Uploaded — live on the storefront (${facts})`);
      }
      sweep(replaced, next);
    } finally {
      setBusy(null);
    }
  };

  /**
   * Clear the slot, save, then delete the file. That order matters: if the delete fails the worst
   * case is an orphan nobody can see, whereas deleting first would leave the storefront pointing
   * at an object that no longer exists for as long as the save took.
   */
  const removeHero = async (slot: HeroSlot) => {
    if (!confirm("Remove this video? The file is deleted from storage and cannot be undone.")) return;
    setBusy(slot);
    try {
      const other: HeroSlot = slot === "heroVideo" ? "heroVideoMobile" : "heroVideo";
      const patch: Record<string, string> = { [slot]: "" };
      const removed = [data[slot] || ""];

      // The floor colour is sampled from the footage. With no clip left it is the colour of a
      // video the homepage no longer has, so it goes with the last one out.
      if (!(data[other] || "").trim()) patch.heroBg = "";

      const next = { ...data, ...patch };
      if (!(await persist(next))) return;
      toast.success(
        next.heroVideo || next.heroVideoMobile
          ? "Removed — live on the storefront"
          : "Removed — the homepage is back to a plain band",
      );
      sweep(removed, next);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel className="space-y-6 p-5">
      <HeroVideoSlot
        label="Hero video — desktop"
        hint="The clip behind the top of the homepage. Uploading one also reads its colour."
        value={data.heroVideo ?? ""}
        busy={busy === "heroVideo"}
        locked={busy !== null}
        onPick={(f) => uploadHero("heroVideo", f)}
        onRemove={() => removeHero("heroVideo")}
      />
      <HeroVideoSlot
        label="Hero video — mobile (under 768px)"
        hint="Optional. Leave it empty and phones get the desktop file instead."
        value={data.heroVideoMobile ?? ""}
        busy={busy === "heroVideoMobile"}
        locked={busy !== null}
        onPick={(f) => uploadHero("heroVideoMobile", f)}
        onRemove={() => removeHero("heroVideoMobile")}
      />

      <div className="space-y-2">
        <SectionLabel>Hero floor colour</SectionLabel>
        {data.heroBg ? (
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-block h-12 w-20 border border-edge"
              style={{ backgroundColor: data.heroBg }}
            />
            <code className="text-[13px] text-faint">{data.heroBg}</code>
          </div>
        ) : (
          <p className="border border-edge bg-canvas px-3 py-2 text-[13px] text-faint">
            No colour — upload a hero video and one is read from it.
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-faint">
          Read automatically from the video, so it always matches the footage. It is the first thing
          a visitor sees, painted instantly while the clip loads, and it is what visitors who have
          turned off animations in their device settings see instead of the video.
        </p>
      </div>

      <p className="text-[11px] leading-relaxed text-faint">
        <strong>The hero saves itself</strong> — uploading or removing a video is live immediately,
        with no need to press Save. Files go straight to storage at full quality, up to{" "}
        {MAX_UPLOAD_BYTES / MB} MB; nothing is re-encoded or downscaled on the way. Two things are
        worth doing in your editor before you export: remove the audio track, because an audio
        track alone stops some phones autoplaying a video even when it is muted, and export with
        “fast start” (the index at the front of the file) or a phone shows nothing at all until the
        whole clip has downloaded.
      </p>

      <div className="border-t border-edge pt-6">
        <StoryImageField label="Story image" value={data.storyImage ?? ""} onChange={set("storyImage")} />
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          The photograph beside the “Who we are” text at the bottom of the homepage. Leaving it empty falls back to the
          image packaged with the site. The wording next to it is edited in Content → Home Page.
        </p>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </Panel>
  );
}
