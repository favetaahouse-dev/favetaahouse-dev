"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Price } from "@/components/Price";
import { cn } from "@/lib/utils";

/**
 * ── Mobile add-to-cart bar ──
 *
 * Appears once the real buying controls have scrolled off the top, and retires again
 * before the recommendations — so it is present for exactly the stretch where a shopper
 * is reading the fabric and packaging notes and has nothing else to act on.
 *
 * Two sentinels: `ctaRef` is the in-flow button row and `endRef` an empty marker after the
 * accordion. Bounding the bar at both ends is also what lets the page skip a permanent
 * bottom padding — it is never on screen at the point where it could cover the footer.
 *
 * Below xl only. On a desktop the whole buying panel is beside the photograph already.
 */
export function StickyBuyBar({
  price,
  compareAt,
  label,
  disabled,
  onAdd,
  ctaRef,
  endRef,
}: {
  price: number;
  compareAt: number | null;
  /** The chosen variant, read back so the bar is not a blind button. e.g. "M · 56" */
  label: string;
  disabled: boolean;
  onAdd: () => void;
  ctaRef: RefObject<HTMLElement | null>;
  endRef: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("product");
  const [shown, setShown] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  /**
   * Publish the bar's height while it is up. The floating currency and WhatsApp buttons
   * are anchored to the same bottom edge, so without this all three land in one 72px band
   * and the price ends up reading through a currency pill. Measured rather than hardcoded
   * because Arabic wraps the variant label to a second line.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--pdp-bar-h", shown ? `${barRef.current?.offsetHeight ?? 0}px` : "0px");
    return () => {
      root.style.removeProperty("--pdp-bar-h");
    };
  }, [shown]);

  /**
   * A rAF-throttled passive scroll read, the same shape Header.tsx uses for its own
   * scroll state, rather than an IntersectionObserver.
   *
   * IO looked like the tidier fit and is the wrong tool here. It reports threshold
   * CROSSINGS, so it says nothing when an element moves from well below the trigger line
   * to well above it between two samples — which a momentum fling on a phone does
   * routinely, and which leaves the bar stuck in whichever state it was last told about.
   * Measuring both edges every frame has no such gap, and `setShown` with an unchanged
   * value costs nothing.
   */
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const cta = ctaRef.current;
      const end = endRef.current;
      if (!cta || !end) return;
      // Entirely above the top of the screen — not merely below the fold, or the bar
      // would be showing on arrival, before the visitor has seen the real buttons.
      const passedCta = cta.getBoundingClientRect().bottom < 0;
      // The end of the copy counts as reached once it climbs into the top fifth. Judged
      // at the bottom edge instead it would land while the real CTA is still on screen,
      // the two windows would never overlap, and the bar could never appear at all.
      const atEnd = end.getBoundingClientRect().top < window.innerHeight * 0.2;
      setShown(passedCta && !atEnd);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ctaRef, endRef]);

  return (
    <div
      ref={barRef}
      // z-30 is BottomBar's own layer and this sits directly on top of it — no overlap,
      // and still under the cart drawer (50) and the lightbox (70).
      // --bottom-bar-clear already folds in the home indicator.
      className={cn(
        "fixed inset-x-0 bottom-[var(--bottom-bar-clear)] z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-sm xl:hidden",
        "transition-transform duration-300 ease-[cubic-bezier(0.24,0.25,0,1)] motion-reduce:transition-none",
        shown ? "translate-y-0" : "translate-y-full",
      )}
      aria-hidden={!shown}
    >
      <div className="mx-auto flex max-w-[560px] items-center gap-4">
        <div className="min-w-0 flex-1">
          <Price cents={price} compareAt={compareAt} className="text-[15px]" />
          {label && <p className="truncate text-[11px] text-muted">{label}</p>}
        </div>
        <button
          onClick={onAdd}
          disabled={disabled}
          // Hidden state is off-screen but still in the layout, so its controls have to
          // leave the tab order too or Tab would land on a button nobody can see.
          tabIndex={shown ? undefined : -1}
          className="btn-brand shrink-0 px-6 py-3"
        >
          {t("addToCart")}
        </button>
      </div>
    </div>
  );
}
