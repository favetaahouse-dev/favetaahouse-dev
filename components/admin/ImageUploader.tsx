"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X, Loader2, Star } from "lucide-react";

type Img = { id: string; url: string; position: number };

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
    <div className="border border-edge bg-surface p-5">
      <h3 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-faint">Images ({images.length})</h3>
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-accent">Cover (main photo)</p>
          {cover ? (
            <div className="group relative aspect-[4/5] w-28 overflow-hidden border border-accent/50 bg-black/10">
              <Image src={cover.url} alt="" fill sizes="112px" className="object-cover" />
              <button onClick={() => remove(cover.id)} className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100" aria-label="Remove"><X size={12} /></button>
            </div>
          ) : (
            <div className="flex aspect-[4/5] w-28 items-center justify-center border border-dashed border-edge text-center text-[10px] text-faint">Upload an image → it becomes the cover</div>
          )}
        </div>

        <div className="flex-1">
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-faint">Gallery</p>
          <div className="flex flex-wrap gap-3">
            {gallery.map((im) => (
              <div key={im.id} className="group relative aspect-[4/5] w-24 overflow-hidden bg-black/10">
                <Image src={im.url} alt="" fill sizes="96px" className="object-cover" />
                <div className="absolute inset-x-0 top-0 flex justify-between p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => setCover(im.id)} className="flex h-5 w-5 items-center justify-center bg-black/70 text-white hover:text-accent" title="Set as cover" aria-label="Set as cover"><Star size={11} /></button>
                  <button onClick={() => remove(im.id)} className="flex h-5 w-5 items-center justify-center bg-black/70 text-white" aria-label="Remove"><X size={12} /></button>
                </div>
              </div>
            ))}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex aspect-[4/5] w-24 flex-col items-center justify-center gap-1 border border-dashed border-edge text-faint hover:border-accent hover:text-accent"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              <span className="text-[10px] uppercase tracking-wider">Upload</span>
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
    </div>
  );
}
