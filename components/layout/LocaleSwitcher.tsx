"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n-navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * The one control on the site whose Latin label must stay Latin on an Arabic page — it IS
 * the English offer, so it belongs in the English face.
 *
 * That fights two unlayered rules in globals.css: `[lang="ar"] body` puts Cairo on
 * everything by inheritance, and `[lang="ar"] .font-button` recasts control labels in Cairo
 * with letter-spacing:0. Both are right for the nav; both are wrong here, and both are
 * unlayered, so no Tailwind utility can win them back (utilities lose to unlayered rules by
 * layer order, whatever the specificity). An inline style is the level above that — hence
 * the tracking living here too rather than in a `tracking-*` class the reset would flatten.
 *
 * Without this the toggle rendered "EN" as Cairo's small, untracked Latin caps, which is
 * what made it read half the size of عربي beside it.
 */
const LATIN = { fontFamily: "var(--font-button)", letterSpacing: "0.16em" } as const;

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
        style={toArabic ? undefined : LATIN}
        className={cn(
          "focus-ring -m-2 p-2 leading-none whitespace-nowrap transition-opacity duration-300 hover:opacity-60",
          // Cairo sets small for its em, so the Arabic offer takes a size up: 13/15 puts
          // Poppins' cap height (0.7em ≈ 9.1px) against Cairo's ع at ~7.5px, which is as
          // close as two scripts get. Sizing is per-script for exactly this reason — a
          // single figure would leave one of the two labels looking shrunken.
          toArabic ? "font-arabic text-[15px] font-semibold" : "text-[13px] font-medium uppercase",
          className,
        )}
      >
        {toArabic ? "عربي" : "EN"}
      </button>
    );
  }

  // The two-label switcher (footer, mobile drawer) shows both scripts AT ONCE, so neither
  // label can take the page's face: on an English page العربية fell back to a system Arabic
  // font with 0.14em prising its joined letters apart, and on an Arabic page English came
  // out as untracked Cairo. Each label is set in its own script's face and size instead —
  // the same 13/11 step the compact toggle uses, for the same reason.
  return (
    <div className={cn("flex items-center gap-2 text-[11px]", className)}>
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 && (
            <span className="opacity-40" aria-hidden>
              /
            </span>
          )}
          <button
            onClick={() => router.replace(pathname, { locale: l })}
            style={l === "ar" ? undefined : LATIN}
            className={cn(
              "transition-opacity hover:opacity-100",
              l === "ar" ? "font-arabic text-[13px]" : "uppercase",
              l === locale ? "opacity-100 underline" : "opacity-60",
            )}
          >
            {l === "ar" ? "العربية" : "English"}
          </button>
        </span>
      ))}
    </div>
  );
}
