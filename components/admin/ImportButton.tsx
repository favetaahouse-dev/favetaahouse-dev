"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

export function ImportButton() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/products/import", { method: "POST", body: text });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      toast.success(`Imported: ${data.created} created, ${data.updated} updated`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="flex items-center gap-2 border border-white/15 px-3 py-1.5 text-[11px] uppercase tracking-wider hover:border-gold disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        Import JSON
      </button>
      <input
        ref={ref}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
