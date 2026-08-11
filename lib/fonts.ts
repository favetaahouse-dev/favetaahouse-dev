import { Playfair_Display, Poppins, Lato, Cairo } from "next/font/google";

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
 * One string to spread onto every <html> (both root layouts) so the variables are in
 * scope for the whole document. Keeping the export name and shape means neither layout
 * has to know how many families there are.
 */
export const fontVars = `${playfair.variable} ${poppins.variable} ${lato.variable} ${cairo.variable}`;
