"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Search } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/lib/i18n-navigation";
import { searchAction } from "@/lib/actions/search";
import { Price } from "@/components/Price";
import type { ProductCardDTO } from "@/lib/data/catalog";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

export function SearchDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  // The results carry the query they belong to, which makes "still loading" a comparison
  // rather than a third piece of state to keep in step with them.
  const [results, setResults] = useState<{ key: string; items: ProductCardDTO[] }>({
    key: "",
    items: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const term = q.trim();
  // Locale is part of the key: the same words in Arabic are a different search.
  const key = `${locale}:${term}`;
  const settled = results.key === key;
  const loading = term !== "" && !settled;
  const items = settled ? results.items : [];

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    // No blanking of `results` for an empty query: the panel below is hidden in that case,
    // so it would only queue a render whose output is not on screen.
    if (!term) return;
    const id = setTimeout(async () => {
      const found = await searchAction(term, locale);
      setResults({ key, items: found });
    }, 250);
    return () => clearTimeout(id);
  }, [key, term, locale]);

  // Clearing the query belongs to the act of closing, not to a reaction to having closed —
  // every close path goes through here, so the drawer reopens empty either way.
  function close() {
    setQ("");
    onClose();
  }

  function submit() {
    if (!q.trim()) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    close();
  }

  return (
    <>
      <div
        onClick={close}
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
            {/* Both marks on this row take the same nav size. The close used to fall through to
                lucide's 24px default while the search glyph was pinned at 20, so the row's two
                icons were visibly different weights either side of the same input. */}
            <Search {...icon.nav} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={t("searchPlaceholder")}
              className="w-full bg-transparent text-lg outline-none placeholder:text-muted"
            />
            <button
              onClick={close}
              aria-label={t("close")}
              className="focus-ring -m-2 p-2 transition-colors hover:text-strong"
            >
              <X {...icon.nav} />
            </button>
          </div>

          {term && (
            <div className="mt-5 max-h-[60vh] overflow-y-auto">
              {loading && <p className="py-6 text-center text-sm text-muted">{t("loading")}</p>}
              {!loading && items.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">{t("noResults")}</p>
              )}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {items.map((p) => (
                  <Link
                    key={p.handle}
                    href={`/products/${p.handle}`}
                    onClick={close}
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
              {items.length > 0 && (
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
