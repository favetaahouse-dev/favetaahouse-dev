"use client";

import { useEffect } from "react";
import type { EmblaCarouselType } from "embla-carousel";

/**
 * Read at call time rather than subscribed to. A preference toggled mid-session is then
 * honoured on the very next interaction, and no component re-renders because of a media
 * query it only ever consults inside a handler.
 */
export function reduceMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Two-way binding between an Embla instance and a controlled index, so a carousel, a
 * lightbox and a colour swatch can all drive the same "which shot are we on".
 *
 * There is no feedback loop: scrollTo() makes Embla emit `select`, which reports the
 * SAME index straight back, and the equality guard below then short-circuits.
 *
 * `onIndexChange` must be referentially stable — pass a useState setter — or the
 * subscription tears down and rebuilds on every render.
 */
export function useEmblaSync(
  embla: EmblaCarouselType | undefined,
  index: number,
  onIndexChange: (i: number) => void,
) {
  useEffect(() => {
    if (!embla) return;
    const read = (api: EmblaCarouselType) => onIndexChange(api.selectedScrollSnap());
    embla.on("select", read).on("reInit", read);
    return () => {
      embla.off("select", read).off("reInit", read);
    };
  }, [embla, onIndexChange]);

  useEffect(() => {
    if (!embla) return;
    if (embla.selectedScrollSnap() === index) return;
    // The `jump` argument, not a duration:0 option — a visitor who asked for less motion
    // still gets a normal-feeling drag; only the programmatic moves become instant.
    embla.scrollTo(index, reduceMotion());
  }, [embla, index]);
}
