"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import useEmblaCarousel from "embla-carousel-react";
import { useEmblaSync, reduceMotion } from "@/lib/carousel";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

export type GalleryImage = { url: string; alt: string | null };

/**
 * ── The product gallery ──
 *
 * One garment shot at a time, with the rest as a rail beside it — vertical on a desktop,
 * a horizontal strip under the photo on anything narrower.
 *
 * The single carousel is the point. It is active at every width, so the phone's swipe and
 * the desktop's thumbnail click are the same mechanism and there is exactly one set of
 * <Image>s in the DOM; only the rail's orientation and the frame's width cap change at
 * the breakpoint. The alternative — a carousel below xl and a separate grid above it —
 * duplicates every photo in the markup to save nothing.
 *
 * The frame is 2:3 everywhere because the photography is 2:3. The stack this replaces
 * cropped its lead shot to 4:5 and left the three below it uncropped, which is what made
 * one gallery look like two.
 */
export function ProductGallery({
  images,
  title,
  index,
  onIndexChange,
  onZoom,
}: {
  images: GalleryImage[];
  title: string;
  /** Controlled, so the lightbox and a colour swatch can move the gallery too. */
  index: number;
  /** Must be referentially stable — it is a dependency of the Embla subscription. */
  onIndexChange: (i: number) => void;
  onZoom: (i: number) => void;
}) {
  const t = useTranslations("product");
  const rtl = useLocale() === "ar";
  const total = images.length;

  const [viewportRef, embla] = useEmblaCarousel({
    // Embla only flips a sign internally; it assumes the DOM already lays out
    // right-to-left, which <html dir="rtl"> from app/[locale]/layout.tsx guarantees.
    direction: rtl ? "rtl" : "ltr",
    // Four shots. A counter that reads 1…4 and stops is honest; looping would make the
    // rail's last thumbnail mean nothing.
    loop: false,
    align: "center",
    containScroll: "trimSnaps",
    dragFree: false, // snap to a shot — a free drag lands between two frames
    watchDrag: total > 1, // a single-image product must not rubber-band
  });

  useEmblaSync(embla, index, onIndexChange);

  // `direction` is only read when the instance is built. Switching locale is a full
  // navigation here so this should never fire — but reInit merges partial options, so
  // the insurance costs one line.
  useEffect(() => {
    embla?.reInit({ direction: rtl ? "rtl" : "ltr" });
  }, [embla, rtl]);

  // After the hooks, never before them. The fallback this replaces was a single image
  // with an empty url, which made the lead render nothing AND suppressed the grid — a
  // product with no photography showed a blank column. Same classes as the catalogue
  // card's placeholder (ProductCardView) so the two cannot drift apart.
  if (total === 0) {
    return (
      <div className="flex aspect-[2/3] w-full items-center justify-center bg-mist px-4 text-center text-[10px] tracking-[0.2em] text-muted uppercase">
        {title}
      </div>
    );
  }

  // flex-col below xl rather than a plain block, because `order` is inert outside a
  // flex/grid container — as a block the rail would follow DOM order and sit ABOVE the
  // photograph, which is the one place it must never be.
  return (
    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-center xl:gap-4">
      {/* The rail. `order` is what moves it from under the photo to beside it. */}
      {total > 1 && (
        <div className="order-2 mt-3 flex justify-center gap-2 xl:order-1 xl:mt-0 xl:w-[76px] xl:shrink-0 xl:flex-col">
          {images.map((im, i) => (
            <button
              key={`${im.url}-thumb-${i}`}
              type="button"
              onClick={() => embla?.scrollTo(i, reduceMotion())}
              aria-label={t("goToImage", { n: i + 1 })}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "focus-ring relative aspect-[2/3] w-12 shrink-0 bg-mist transition-opacity duration-200 motion-reduce:transition-none xl:w-full",
                i === index
                  ? "opacity-100 ring-1 ring-strong ring-offset-2"
                  : "opacity-55 hover:opacity-90",
              )}
            >
              <Image src={im.url} alt="" fill sizes="76px" loading="lazy" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="order-1 xl:order-2">
        <div
          role="group"
          aria-roledescription="carousel"
          aria-label={t("gallery")}
          className="relative"
        >
          {/* Full-bleed on a phone: -mx-4 reclaims the page gutter, which is 8% more
              garment and reads as a lookbook rather than a card. Every width lives in
              .pdp-stage — see the note there for why none of it is a utility. */}
          <div
            ref={viewportRef}
            className="pdp-stage -mx-4 overflow-hidden sm:mx-auto xl:mx-0"
          >
            {/* touch-pan-y, or a vertical page scroll fights the horizontal drag.
                min-w-0 on the slides, or flex refuses to shrink them and you see
                fragments of three at once. */}
            <div className="flex touch-pan-y">
              {images.map((im, i) => (
                <button
                  key={`${im.url}-${i}`}
                  type="button"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={t("zoom", { n: i + 1, total })}
                  onClick={() => onZoom(i)}
                  className="img-zoom focus-ring relative aspect-[2/3] min-w-0 flex-[0_0_100%] cursor-zoom-in bg-mist"
                >
                  <Image
                    src={im.url}
                    alt={im.alt ?? title}
                    fill
                    sizes="(max-width: 639px) 100vw, (max-width: 1279px) 440px, 620px"
                    // next.config.ts runs the optimizer off, so `sizes` builds no srcset
                    // and `loading` is the only lever left — and it is worth pulling:
                    // deferring the other three shots takes a four-photo product from
                    // ~1.2MB to ~270KB on arrival. loading/fetchPriority rather than
                    // `priority`, which Next 16 deprecated (see Header.tsx).
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Arrows are a pointer affordance, so they start at sm. On a phone a chevron
              sitting on top of a 585px photograph costs more than the swipe buys.
              .flip-x goes on the glyph, not the button, so the RTL mirror never collides
              with the button's own -translate-y-1/2. */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => embla?.scrollPrev(reduceMotion())}
                aria-label={t("previousImage")}
                className="focus-ring absolute start-2 top-1/2 hidden -translate-y-1/2 bg-paper/85 p-2.5 text-ink transition-colors hover:bg-paper hover:text-strong sm:block"
              >
                <ChevronLeft {...icon.action} className="flip-x" />
              </button>
              <button
                type="button"
                onClick={() => embla?.scrollNext(reduceMotion())}
                aria-label={t("nextImage")}
                className="focus-ring absolute end-2 top-1/2 hidden -translate-y-1/2 bg-paper/85 p-2.5 text-ink transition-colors hover:bg-paper hover:text-strong sm:block"
              >
                <ChevronRight {...icon.action} className="flip-x" />
              </button>
            </>
          )}
        </div>

        {/* A live region announces its text CONTENT, so the long form has to be in the
            DOM rather than on an aria-label. The sighted "1 / 4" is desktop-only: under
            the photograph on a phone the rail already says where you are, and the line
            would cost 30px of the screen the price is trying to reach. With only the
            sr-only span left the paragraph collapses to nothing there. */}
        {total > 1 && (
          <p
            aria-live="polite"
            aria-atomic="true"
            className="text-center font-button text-[11px] tracking-[0.14em] text-muted xl:mt-3"
          >
            <span className="sr-only">{t("image", { n: index + 1, total })}</span>
            <span aria-hidden className="hidden xl:inline">
              {t("counter", { n: index + 1, total })}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
