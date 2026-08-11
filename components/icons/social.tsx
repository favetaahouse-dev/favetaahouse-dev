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
      {/* speech bubble with a tail at the lower-leading corner */}
      <path d="M5 19l1.1-3.2A7.6 7.6 0 1 1 8.9 18.6z" />
      {/* simplified handset sweep */}
      <path d="M9.2 9.6c-.2 0-.5.08-.66.33-.16.25-.6.86-.6 1.6 0 .74.62 1.7.9 2.05.28.35 1.2 1.5 2.7 2.05.9.33 1.3.28 1.55.2.28-.08.86-.4 1-.78.14-.38.14-.7.1-.78" />
    </LineIcon>
  );
}
