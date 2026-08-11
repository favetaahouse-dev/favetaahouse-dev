"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n-navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  // Compact: a single button showing the OTHER language — for the navbar, where a
  // one-tap toggle reads cleaner than the two-label switcher used in the mobile drawer.
  //
  // The label is set in the script it OFFERS, not the one the page is in: on an English
  // page the control says عربي in Cairo, on an Arabic page it says EN in Poppins. A reader
  // recognises their own script before they read any word, so this is legible as a language
  // switch without a globe icon or a flag — and flags are wrong for Arabic anyway, which is
  // spoken across two dozen countries.
  //
  // `-m-2 p-2` is the header's hit-area idiom: it grows a ~30px label to a 40px+ target
  // without moving anything, because the negative margin gives back what the padding takes.
  // Colour is inherited so the control works both on the cream bar and over the hero video,
  // where the whole header is white — hence opacity for the hover, never a colour swap.
  if (compact) {
    const other = routing.locales.find((l) => l !== locale) ?? locale;
    const toArabic = other === "ar";
    return (
      <button
        onClick={() => router.replace(pathname, { locale: other })}
        aria-label={toArabic ? "التبديل إلى العربية" : "Switch to English"}
        className={cn(
          "focus-ring -m-2 p-2 leading-none whitespace-nowrap transition-opacity duration-300 hover:opacity-60",
          // Cairo sets small for its em, so the Arabic offer needs a size up to match the
          // optical weight of EN beside it.
          toArabic
            ? "font-arabic text-[15px] font-semibold"
            : "font-button text-[11px] font-medium tracking-[0.16em] uppercase",
          className,
        )}
      >
        {toArabic ? "عربي" : "EN"}
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 font-button text-[11px] uppercase tracking-[0.14em]", className)}>
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 && <span className="opacity-40">/</span>}
          <button
            onClick={() => router.replace(pathname, { locale: l })}
            className={cn("transition-opacity hover:opacity-100", l === locale ? "opacity-100 underline" : "opacity-60")}
          >
            {l === "ar" ? "العربية" : "English"}
          </button>
        </span>
      ))}
    </div>
  );
}
