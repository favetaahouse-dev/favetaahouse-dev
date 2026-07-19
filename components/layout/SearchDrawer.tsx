"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n-navigation";
import { searchAction } from "@/lib/actions/search";
import { Price } from "@/components/Price";
import type { ProductCardDTO } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

export function SearchDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductCardDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
    else {
      setQ("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      const r = await searchAction(q);
      setResults(r);
      setLoading(false);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  function submit() {
    if (!q.trim()) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    onClose();
  }

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-50 bg-paper text-ink transition-transform duration-500 ease-[cubic-bezier(0.24,0.25,0,1)]",
          open ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <div className="mx-auto max-w-3xl px-5 py-6">
          <div className="flex items-center gap-3 border-b border-ink pb-3">
            <Search size={20} strokeWidth={1.4} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={t("searchPlaceholder")}
              className="w-full bg-transparent text-lg outline-none placeholder:text-muted"
            />
            <button onClick={onClose} aria-label={t("close")}>
              <X strokeWidth={1.5} />
            </button>
          </div>

          {q.trim() && (
            <div className="mt-5 max-h-[60vh] overflow-y-auto">
              {loading && <p className="py-6 text-center text-sm text-muted">{t("loading")}</p>}
              {!loading && results.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">{t("noResults")}</p>
              )}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {results.map((p) => (
                  <Link
                    key={p.handle}
                    href={`/products/${p.handle}`}
                    onClick={onClose}
                    className="group block"
                  >
                    <div className="relative aspect-[4/5] bg-mist">
                      {p.image && (
                        <Image src={p.image} alt={p.title} fill sizes="25vw" className="object-cover" />
                      )}
                    </div>
                    <p className="mt-2 text-[12px]">{p.title}</p>
                    <div className="text-[12px]">
                      <Price cents={p.priceMin} compareAt={p.compareAtMax} />
                    </div>
                  </Link>
                ))}
              </div>
              {results.length > 0 && (
                <button onClick={submit} className="btn-outline mt-6 w-full">
                  {t("viewProduct")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
