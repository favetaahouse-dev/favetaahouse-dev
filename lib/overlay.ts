"use client";

import { useEffect, useSyncExternalStore, type RefObject } from "react";

/**
 * ── The four things every overlay needs ──
 *
 * These started life inside components/admin/ui/Modal.tsx. The markup there is not
 * reusable — it paints bg-surface/border-edge, which resolve to the admin console's own
 * --admin-* scale — but the hooks carry no tokens at all, so they live here and both the
 * back-office modals and the storefront lightbox share one copy rather than drifting.
 */

const noop = () => () => {};

/**
 * false during SSR and the first client render, true after mount.
 *
 * This is the guard createPortal needs, expressed without an effect-driven setState:
 * useSyncExternalStore's server snapshot is what the prerender and the hydration pass
 * both read, so the two agree by construction instead of by luck.
 */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function useEscape(onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [active, onClose]);
}

/**
 * Freezes the document behind an overlay, and hands back the width of the scrollbar it
 * just removed as padding so the page does not jump sideways on open.
 *
 * The compensation is padding-inline-end rather than padding-right so it lands on the
 * correct side in Arabic. It cannot reach a `fixed` layer — the header will still shift
 * by the scrollbar width — but the header is underneath the overlay and invisible while
 * this is active, so the only shift anyone sees is the one this prevents.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { style } = document.body;
    const prevOverflow = style.overflow;
    const prevPad = style.paddingInlineEnd;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    style.overflow = "hidden";
    if (gap > 0) style.paddingInlineEnd = `${gap}px`;
    return () => {
      style.overflow = prevOverflow;
      style.paddingInlineEnd = prevPad;
    };
  }, [active]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Moves focus into the overlay, keeps Tab inside it, and returns focus to whatever
 * opened it — so closing a lightbox from the keyboard puts the caret back on the
 * thumbnail that was activated, not at the top of the document.
 *
 * Visibility is tested with getClientRects(), deliberately not offsetParent: offsetParent
 * is null for everything inside a `fixed` layer, which is exactly where this runs, and
 * would have filtered out every control in the dialog.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.getClientRects().length > 0,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [ref, active]);
}
