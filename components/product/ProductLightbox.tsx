"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import useEmblaCarousel from "embla-carousel-react";
import { useMounted, useEscape, useBodyScrollLock, useFocusTrap } from "@/lib/overlay";
import { useEmblaSync, reduceMotion } from "@/lib/carousel";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "./ProductGallery";

/**
 * ── The zoomed gallery ──
 *
 * Rendered only while open, with no `open` prop: the scroll lock and the focus trap are
 * mount/unmount effects, so letting the component exist in a closed state would mean
 * every one of them needed a guard.
 *
 * Portalled to document.body. The version this replaces was `fixed inset-0` inside the
 * PDP's own subtree, which is correct exactly until some ancestor grows a transform or a
 * filter and silently turns itself into the containing block.
 */
export function ProductLightbox({
  images,
  title,
  index,
  onIndexChange,
  onClose,
}: {
  images: GalleryImage[];
  title: string;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  const rtl = useLocale() === "ar";
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const total = images.length;

  const [viewportRef, embla] = useEmblaCarousel({
    direction: rtl ? "rtl" : "ltr",
    // Embla falls back to loop:false on its own when there are too few slides to loop,
    // so this is a preference rather than a guard: past two shots, wrapping around inside
    // a full-screen viewer is what a visitor expects.
    loop: total > 2,
    align: "center",
    startIndex: index,
    watchDrag: total > 1,
  });

  useEmblaSync(embla, index, onIndexChange);
  useEscape(onClose, true);
  useBodyScrollLock(true);
  useFocusTrap(panelRef, true);

  // Arrow keys follow the READING direction, per the APG carousel pattern: in Arabic the
  // next slide sits to the left, so ArrowLeft has to advance.
  useEffect(() => {
    if (!embla) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const jump = reduceMotion();
      const forward = rtl ? e.key === "ArrowLeft" : e.key === "ArrowRight";
      if (forward) embla.scrollNext(jump);
      else embla.scrollPrev(jump);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [embla, rtl]);

  if (!mounted) return null;

  return createPortal(
    // Click-to-close lives on the backdrop and each interactive region stops propagation.
    // A single stopPropagation on the dialog would be tidier and would kill the
    // affordance outright.
    <div className="fixed inset-0 z-[70] bg-black/95" onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t("gallery")}
        className="relative flex h-full flex-col outline-none"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-2"
        >
          <p
            aria-live="polite"
            aria-atomic="true"
            className="font-button text-[12px] tracking-[0.14em] text-white/80"
          >
            <span className="sr-only">{t("image", { n: index + 1, total })}</span>
            <span aria-hidden>{t("counter", { n: index + 1, total })}</span>
          </p>
          {/* focus-ring carries the outline; focus-ring-invert only recolours it. On
              black the pair is mandatory — -invert alone draws nothing at all. */}
          <button
            type="button"
            onClick={onClose}
            aria-label={tc("close")}
            className="focus-ring focus-ring-invert -m-2 p-2 text-white"
          >
            <X {...icon.overlay} />
          </button>
        </div>

        <div ref={viewportRef} className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full touch-pan-y">
            {images.map((im, i) => (
              <div
                key={`${im.url}-${i}`}
                role="group"
                aria-roledescription="slide"
                aria-label={t("image", { n: i + 1, total })}
                className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center px-4 sm:px-16"
              >
                <div
                  className="relative h-full w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Image
                    src={im.url}
                    alt={im.alt ?? title}
                    fill
                    sizes="100vw"
                    // Same URLs as the gallery behind this, and the optimizer is off, so
                    // the current shot is already in cache and paints at once. Only the
                    // two neighbours are worth fetching ahead of a swipe.
                    loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                    className="object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                embla?.scrollPrev(reduceMotion());
              }}
              aria-label={t("previousImage")}
              className="focus-ring focus-ring-invert absolute start-1 top-1/2 hidden -translate-y-1/2 p-3 text-white/70 transition-colors hover:text-white sm:block"
            >
              <ChevronLeft {...icon.overlay} className="flip-x" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                embla?.scrollNext(reduceMotion());
              }}
              aria-label={t("nextImage")}
              className="focus-ring focus-ring-invert absolute end-1 top-1/2 hidden -translate-y-1/2 p-3 text-white/70 transition-colors hover:text-white sm:block"
            >
              <ChevronRight {...icon.overlay} className="flip-x" />
            </button>
          </>
        )}

        {total > 1 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="no-scrollbar flex justify-center gap-2 overflow-x-auto px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
          >
            {images.map((im, i) => (
              <button
                key={`${im.url}-thumb-${i}`}
                type="button"
                onClick={() => embla?.scrollTo(i, reduceMotion())}
                aria-label={t("goToImage", { n: i + 1 })}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "focus-ring focus-ring-invert relative aspect-[2/3] h-16 shrink-0 bg-white/10 transition-opacity duration-200 motion-reduce:transition-none",
                  i === index ? "opacity-100 ring-1 ring-white" : "opacity-45 hover:opacity-80",
                )}
              >
                <Image src={im.url} alt="" fill sizes="48px" loading="lazy" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
