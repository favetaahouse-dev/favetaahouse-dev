import { absoluteStroke } from "@/lib/icon";

type IconProps = { size?: number; className?: string };

/** One size for the whole set — a mixed row of 18s and 19s only ever looked like a mistake. */
const SOCIAL_SIZE = 22;

/**
 * One cohesive line set — every mark is a single-weight outline on a 24-grid, so the
 * footer/social row reads as one family rather than a mix of stroked + filled glyphs.
 * Constructions are geometric (circles, a rounded rect, simple paths) to stay crisp at
 * the small sizes these render at. Colour inherits via currentColor.
 *
 * The stroke is computed rather than fixed at 1.5: these are drawn on a 24 viewBox but
 * rendered smaller, so a literal 1.5 painted a 1.19px line while the lucide icons beside
 * them painted 1.6px. absoluteStroke() is the same arithmetic lucide's `absoluteStrokeWidth`
 * does, which is what puts both sets on one hairline no matter what size is passed.
 */
function LineIcon({
  size = SOCIAL_SIZE,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={absoluteStroke(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function InstagramIcon({ size = SOCIAL_SIZE, className }: IconProps) {
  return (
    <LineIcon size={size} className={className}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </LineIcon>
  );
}

export function FacebookIcon({ size = SOCIAL_SIZE, className }: IconProps) {
  return (
    <LineIcon size={size} className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M13.9 8h-1c-1 0-1.6.62-1.6 1.8V19.4" />
      <path d="M9.3 12.3h4.6" />
    </LineIcon>
  );
}

export function YoutubeIcon({ size = SOCIAL_SIZE, className }: IconProps) {
  return (
    <LineIcon size={size} className={className}>
      <rect x="2.5" y="5.8" width="19" height="12.4" rx="3.6" />
      <path d="M10.3 9.6l4.8 2.7-4.8 2.7z" />
    </LineIcon>
  );
}

export function TiktokIcon({ size = SOCIAL_SIZE, className }: IconProps) {
  return (
    <LineIcon size={size} className={className}>
      <path d="M13.2 4.5v10.9" />
      <circle cx="10.1" cy="15.4" r="3.1" />
      <path d="M13.2 4.5c.4 2.3 2.1 3.95 4.3 4.05" />
    </LineIcon>
  );
}

export function WhatsAppIcon({ size = SOCIAL_SIZE, className }: IconProps) {
  return (
    <LineIcon size={size} className={className}>
      {/* A full r=9 circle centred on the grid — the same footprint as the Facebook and
          YouTube marks — opened at the lower left for a short tail nub. That silhouette,
          not the handset, is what identifies the mark at 22px, so it gets the room.
          The tail stays bottom-left in Arabic: it is a trademark, and a mirrored bubble
          reads as some other product. */}
      <path d="M3 21l1.65-3.8A9 9 0 1 1 8.05 20.1z" />
      {/* The receiver as a centreline hook — stub, quarter turn, stub — rather than the
          usual outlined handset. Outlining it means ear and mouth pieces about 1 unit
          across while the hairline here is 1.75, so they flood solid and the glyph turns
          to mush; one round-capped stroke keeps the sweep and stays open. */}
      <path d="M8.2 8.2v1.6a6 6 0 0 0 6 6h1.6" />
    </LineIcon>
  );
}
