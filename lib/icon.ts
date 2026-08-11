/**
 * ── One icon scale for the storefront ──
 *
 * Every lucide glyph on the site is spread from this table rather than given its own
 * `size`/`strokeWidth` at the call site, which is how the set had drifted to seven sizes
 * (13, 14, 15, 16, 18, 20, 22) and three weights across a dozen files.
 *
 * `absoluteStrokeWidth` is the part that actually buys legibility. Without it lucide scales
 * the stroke with the box — the rendered hairline is `strokeWidth × size / 24` — so a 13px
 * stepper and a 22px menu drawn "at 1.25" paint 0.68px and 1.15px lines: the small one lands
 * below a device pixel and greys out, and the set reads as several weights. With it every mark
 * paints the same ICON_WEIGHT hairline at any size, which is what makes a mixed-size set look
 * like one family.
 *
 * 1.6px is the deliberate ceiling: lucide's own default (2px at 24) is too industrial for a
 * monochrome fashion storefront whose borders are 1px hairlines, and the 1.0–1.2px the site
 * used before was too faint to survive a white bar, a video frame or a phone at arm's length.
 */
export const ICON_WEIGHT = 1.6;

const line = (size: number) =>
  ({ size, strokeWidth: ICON_WEIGHT, absoluteStrokeWidth: true }) as const;

export const icon = {
  /** Header and bottom-bar controls — the marks that carry the navigation on every page. */
  nav: line(24),
  /** Panel furniture: drawer/sheet close, toolbar disclosures, standalone buttons. */
  action: line(20),
  /** Paired with a text label, sized to sit against its cap height. */
  inline: line(18),
  /** Inside a tight bordered group — quantity steppers, chip dismissals. */
  micro: line(16),
  /** A single mark alone on a full-screen overlay, with no label to lend it scale. */
  overlay: line(28),
  /**
   * The one deliberate exception to ICON_WEIGHT. A 48px celebratory mark (order placed) is
   * set beside a section-title, not beside body copy, and the hairline that reads correctly
   * at 16–28px looks spindly blown up to three times the size. 2.4px is what it already
   * rendered at; it lives here so the number is a decision rather than a stray literal.
   */
  display: { size: 48, strokeWidth: 2.4, absoluteStrokeWidth: true },
} as const;

/**
 * The hand-drawn social set (components/icons/social.tsx) is not lucide, so it cannot take
 * `absoluteStrokeWidth`. This is that prop's arithmetic, exported so those marks land on the
 * same 1.6px hairline as everything above instead of drifting a third of a pixel lighter.
 */
export function absoluteStroke(size: number) {
  return (ICON_WEIGHT * 24) / size;
}
