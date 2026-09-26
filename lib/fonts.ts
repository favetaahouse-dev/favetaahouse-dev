import { Playfair_Display, Poppins, Lato, Cairo } from "next/font/google";
import localFont from "next/font/local";

/**
 * Four faces, three jobs, no overlap.
 *
 * The storefront used to run one geometric grotesque for everything, which is a
 * defensible system but a mute one — every role sounded the same. The house voice is
 * editorial now, so the type does what a fashion magazine's does: a high-contrast serif
 * carries the headlines, a humanist sans carries the prose, and a geometric sans carries
 * anything that behaves like a control. Mixing those three is only safe because each has
 * exactly one job; the moment Playfair sets a paragraph the whole thing collapses.
 *
 * Weights are declared ONLY for the static-only families. Playfair Display and Cairo ship
 * as true variable fonts on Google Fonts, and naming weights for those makes next/font
 * download a separate static instance per weight — the opposite of what is wanted.
 */

/** Display only: h1–h6, .display, .section-title. Italic is loaded because a single
 *  italic phrase inside a serif headline is the cheapest editorial move there is. */
export const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  style: ["normal", "italic"],
});

/** Controls: nav, buttons, eyebrows, badges, form labels. Three weights is the whole
 *  range an interface needs; Poppins is static-only, so each one is a real file. */
export const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  weight: ["400", "500", "600"],
});

/** Body copy. 300 exists for captions and long-form leads, where Lato's regular is a
 *  touch heavy at the line lengths this layout uses. */
export const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  display: "swap",
  weight: ["300", "400", "700"],
});

/**
 * Arabic, for every role — heading, body and control alike. The serif/sans split that
 * carries hierarchy in Latin has no equivalent in the script, so Arabic pages get their
 * hierarchy from weight and scale instead (see the [dir="rtl"] rules in globals.css).
 *
 * `preload: false` is deliberate: preloading is per-document, and an English page would
 * otherwise pay for an Arabic face it will never paint a glyph from. Arabic pages still
 * get it — the browser fetches it the moment the first Cairo-styled text is laid out —
 * they just start it a beat later, which is the correct side of that trade when the
 * alternative taxes the default locale on every visit.
 *
 * Replaces the self-hosted "Janna LT", which was a single BOLD file declared across
 * `font-weight: 400 700`: every Arabic weight was the same artwork, synthesised, so the
 * script had no real type ramp at all.
 */
export const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
  preload: false,
});

/**
 * Cairo's ARABIC letters, drawn larger — so Arabic reads the same size as English at the same px.
 *
 * Measured in the browser: at one font-size Cairo's Arabic body stands exactly as tall as Lato's
 * x-height (0.50 vs 0.51 em) and its alef as tall as Lato's capitals (0.72 em) — yet an Arabic
 * word sets ~20% narrower than the English one, in thinner strokes, and ~35% narrower than the
 * tracked capitals the buttons and labels use. So Arabic looked a size smaller everywhere.
 *
 * `size-adjust` enlarges the glyphs without touching font-size, so none of the storefront's fixed
 * pixel sizes needs an Arabic twin; `unicode-range` (Google's own Arabic-subset range for Cairo
 * v31) confines it to Arabic, so the Latin on an Arabic page — a product name, a price, "XS" —
 * falls through to `cairo` above at its normal size. Two faces from one 31 KB file: running text
 * at 112%, interface labels at 120% (their English twins are tracked capitals, which read larger
 * than lowercase). Wired up as --font-arabic / --font-arabic-ui in app/globals.css.
 *
 * Self-hosted from fonts.gstatic.com because next/font/google cannot take font-face descriptors.
 * Cairo is licensed under the SIL Open Font License 1.1. Not preloaded, for the same reason as
 * `cairo`. No fallback metrics: the next family in the stack, `cairo`, is the fallback.
 */
export const cairoArabic = localFont({
  src: "../app/fonts/cairo-arabic.woff2",
  variable: "--font-cairo-ar",
  weight: "200 1000",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "size-adjust", value: "112%" },
    {
      prop: "unicode-range",
      value:
        "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EEFF",
    },
  ],
});

export const cairoArabicUi = localFont({
  src: "../app/fonts/cairo-arabic.woff2",
  variable: "--font-cairo-ar-ui",
  weight: "200 1000",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "size-adjust", value: "120%" },
    {
      prop: "unicode-range",
      value:
        "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EEFF",
    },
  ],
});

/**
 * One string to spread onto every <html> (both root layouts) so the variables are in
 * scope for the whole document. Keeping the export name and shape means neither layout
 * has to know how many families there are.
 */
export const fontVars = `${playfair.variable} ${poppins.variable} ${lato.variable} ${cairo.variable} ${cairoArabic.variable} ${cairoArabicUi.variable}`;
