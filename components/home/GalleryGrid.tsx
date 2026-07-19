"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Image-only gallery cards (ryzo talent-card look, brand-adapted) + a full-screen lightbox.
 * Plain <img> on purpose: gallery URLs are admin-editable and may point at arbitrary hosts,
 * which next/image would reject; the project also serves images unoptimised anyway.
 */
export function GalleryGrid({ images, label }: { images: string[]; label: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const rtl = locale === "ar";

  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;
  // Remember what to focus when the lightbox closes.
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const go = useCallback(
    (delta: number) =>
      setIndex((cur) => (cur === null ? cur : (cur + delta + images.length) % images.length)),
    [images.length],
  );

  // Keyboard + body-scroll lock while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(rtl ? -1 : 1);
      else if (e.key === "ArrowLeft") go(rtl ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      triggerRef.current?.focus();
    };
  }, [open, close, go, rtl]);

  const ctrl =
    "absolute z-10 flex h-11 w-11 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:text-white outline-none";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {images.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            aria-label={`${label} ${i + 1}`}
            onClick={(e) => {
              triggerRef.current = e.currentTarget;
              setIndex(i);
            }}
            className="group relative block aspect-[3/4] cursor-zoom-in overflow-hidden border border-signal/10 transition-all duration-500 hover:-translate-y-0.5 hover:border-signal/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-signal/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-transparent transition-colors duration-500 group-hover:ring-signal/25" />
          </button>
        ))}
      </div>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 outline-none backdrop-blur-sm"
        >
          <button type="button" onClick={close} aria-label={t("close")} className={`${ctrl} end-3 top-3`}>
            <X size={22} strokeWidth={1.4} />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label={t("previous")}
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className={`${ctrl} start-2 top-1/2 -translate-y-1/2 sm:start-4`}
              >
                <ChevronLeft className="flip-x" size={30} strokeWidth={1.4} />
              </button>
              <button
                type="button"
                aria-label={t("next")}
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className={`${ctrl} end-2 top-1/2 -translate-y-1/2 sm:end-4`}
              >
                <ChevronRight className="flip-x" size={30} strokeWidth={1.4} />
              </button>
            </>
          )}

          <div className="mx-12 flex max-h-[88vh] flex-col items-center sm:mx-16" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[index]}
              alt=""
              className="max-h-[82vh] w-auto max-w-full object-contain"
            />
            {images.length > 1 && (
              <div className="mt-3 text-[11px] uppercase tracking-[0.2em] text-white/55" dir="ltr">
                {index + 1} / {images.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
