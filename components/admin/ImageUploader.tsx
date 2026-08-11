"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X, Loader2, Star } from "lucide-react";
import { Panel, PanelHeader } from "./ui";
import { cn } from "@/lib/utils";

type Img = { id: string; url: string; position: number };

/**
 * Tile overlay buttons.
 *
 * Permanently visible, on a scrim, rather than the `opacity-0 group-hover:opacity-100` these
 * used to carry. Hover-only affordances failed three ways at once here: the panel showed no
 * sign at rest that a photo could be promoted or deleted at all, there is no hover on a phone,
 * and a keyboard user tabbed onto a completely invisible Delete button.
 *
 * 28px rather than 20px — two of them plus padding still fit across a 96px tile.
 */
function TileButton({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-[3px] bg-black/65 text-white backdrop-blur-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
        danger ? "hover:bg-danger" : "hover:bg-white hover:text-black",
      )}
    >
      {children}
    </button>
  );
}

export function ImageUploader({ productId, initial }: { productId: string; initial: Img[] }) {
  const router = useRouter();
  const [images, setImages] = useState<Img[]>([...initial].sort((a, b) => a.position - b.position));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cover = images[0];
  const gallery = images.slice(1);

  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/products/${productId}/images`, { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? "Upload failed");
      return;
    }
    const row = await res.json();
    setImages((p) => [...p, { id: row.id, url: row.url, position: row.position }]);
    toast.success("Image uploaded");
  }

  async function remove(imageId: string) {
    setImages((p) => p.filter((i) => i.id !== imageId));
    await fetch(`/api/admin/products/${productId}/images`, { method: "DELETE", body: JSON.stringify({ imageId }) });
  }

  async function setCover(imageId: string) {
    setImages((p) => {
      const pick = p.find((i) => i.id === imageId);
      if (!pick) return p;
      return [pick, ...p.filter((i) => i.id !== imageId)].map((im, idx) => ({ ...im, position: idx }));
    });
    await fetch(`/api/admin/products/${productId}/images`, { method: "PATCH", body: JSON.stringify({ coverId: imageId }) });
    toast.success("Cover updated");
    router.refresh();
  }

  return (
    // Panel + PanelHeader rather than a hand-rolled div and an orphan <h3>: this is now the
    // <h2> the page's heading outline was missing between the product title and the tiles.
    <Panel>
      <PanelHeader
        title={`Images (${images.length})`}
        description="The first image is the cover — it is what shoppers see in the catalogue. Use ★ on any gallery photo to promote it."
      />
      <div className="flex flex-wrap gap-6 p-5" aria-busy={busy}>
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-secondary">Cover (main photo)</p>
          {cover ? (
            <div className="relative aspect-[4/5] w-28 overflow-hidden border border-accent bg-black/10">
              <Image src={cover.url} alt="Cover photo" fill sizes="112px" className="object-cover" />
              {/* Scrim, so white glyphs stay legible over a pale garment without hiding the photo. */}
              <div className="absolute inset-x-0 top-0 flex justify-between gap-1 bg-gradient-to-b from-black/55 to-transparent p-1 pb-4">
                <span className="rounded-[3px] bg-black/75 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white">
                  Cover
                </span>
                <TileButton onClick={() => remove(cover.id)} label="Remove the cover image" danger>
                  <X size={14} />
                </TileButton>
              </div>
            </div>
          ) : (
            <div className="flex aspect-[4/5] w-28 items-center justify-center border border-dashed border-field p-2 text-center text-[11px] leading-snug text-secondary">
              Upload an image → it becomes the cover
            </div>
          )}
        </div>

        <div className="flex-1">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-secondary">Gallery</p>
          <div className="flex flex-wrap gap-3">
            {gallery.map((im, idx) => (
              // Names carry the position. Every tile used to ship the identical pair
              // "Set as cover" / "Remove", so a screen-reader element list was a column of
              // interchangeable destructive controls. +2 because index 0 IS the cover.
              <div key={im.id} className="relative aspect-[4/5] w-24 overflow-hidden border border-edge bg-black/10">
                <Image src={im.url} alt={`Product photo ${idx + 2}`} fill sizes="96px" className="object-cover" />
                <div className="absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/55 to-transparent p-1 pb-4">
                  <TileButton onClick={() => setCover(im.id)} label={`Make photo ${idx + 2} the cover`}>
                    <Star size={13} />
                  </TileButton>
                  <TileButton onClick={() => remove(im.id)} label={`Remove photo ${idx + 2}`} danger>
                    <X size={14} />
                  </TileButton>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex aspect-[4/5] w-24 flex-col items-center justify-center gap-1 border border-dashed border-field text-secondary transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              <span className="text-[10px] uppercase tracking-wider">{busy ? "Uploading" : "Upload"}</span>
            </button>
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
    </Panel>
  );
}
