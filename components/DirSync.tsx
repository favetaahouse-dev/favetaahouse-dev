"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

/**
 * Re-syncs <html dir/lang> on client navigation (ryzo convention).
 *
 * Reads the locale rather than the pathname: `locale` is enumerated by the layout's
 * generateStaticParams, so it is known while prerendering, whereas the full pathname is
 * runtime data on any route with an un-enumerated param (/products/[handle] fallbacks,
 * /account/orders/[id]) and would keep those pages from producing a static shell.
 */
export function DirSync() {
  const isArabic = useLocale() === "ar";
  useEffect(() => {
    const html = document.documentElement;
    html.dir = isArabic ? "rtl" : "ltr";
    html.lang = isArabic ? "ar" : "en";
  }, [isArabic]);
  return null;
}
