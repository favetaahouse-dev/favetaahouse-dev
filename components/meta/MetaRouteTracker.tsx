"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { captureFbclid, trackMeta } from "@/lib/meta/fbq";

/**
 * PageView on every route change.
 *
 * The base snippet in MetaPixel.tsx deliberately does NOT call fbq('track','PageView') — this
 * component owns every PageView, including the first. Doing both is the classic Next.js pixel
 * bug: the snippet fires one on load, the effect fires another on mount, and every landing is
 * counted twice for the rest of the site's life.
 *
 * `usePathname` from next/navigation, NOT from @/lib/i18n-navigation. The i18n-aware one strips
 * the locale prefix, so switching EN -> AR would return the same pathname and no PageView would
 * fire for a language the shopper genuinely navigated to. Here we want the raw URL.
 *
 * `useSearchParams` is deliberately not used. It would force this component into a Suspense
 * boundary and, more importantly, would fire a PageView on every collection filter tweak
 * (components/collection/CollectionToolbar.tsx writes filters into the query string), flooding
 * the pixel with noise. Path-level granularity is the right unit for PageView.
 *
 * Renders null. Safe to mount in the prerendered shell: client hooks do not de-opt the static
 * shell the way a server-side cookies()/headers() read would.
 */
export function MetaRouteTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  // Capture an inbound ad click once, as early as possible — before the shopper can navigate away
  // and lose the fbclid from the URL.
  useEffect(() => {
    captureFbclid();
  }, []);

  useEffect(() => {
    if (!pathname || lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    trackMeta("PageView");
  }, [pathname]);

  return null;
}
