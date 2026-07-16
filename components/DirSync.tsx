"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Re-syncs <html dir/lang> on client navigation (ryzo convention). */
export function DirSync() {
  const pathname = usePathname();
  const isArabic = pathname === "/ar" || pathname.startsWith("/ar/");
  useEffect(() => {
    const html = document.documentElement;
    html.dir = isArabic ? "rtl" : "ltr";
    html.lang = isArabic ? "ar" : "en";
  }, [isArabic]);
  return null;
}
