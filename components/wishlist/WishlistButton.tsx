"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/components/providers/wishlist-context";
import { trackMeta } from "@/lib/meta/fbq";
import { addToWishlistPayload } from "@/lib/meta/events";
import { ICON_WEIGHT, icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

export function WishlistButton({
  handle,
  className,
  size = icon.action.size,
}: {
  handle: string;
  className?: string;
  size?: number;
}) {
  const { has, toggle } = useWishlist();
  const active = has(handle);
  return (
    <button
      type="button"
      aria-label="Add to wishlist"
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only on ADD. `active` is the pre-click state, so !active means this click is adding.
        // Reporting a removal as an AddToWishlist would be a straightforward lie to the model.
        if (!active) trackMeta("AddToWishlist", addToWishlistPayload({ handle }));
        toggle(handle);
      }}
      className={cn(
        // 36px chip, not 32: this floats over product photography, where a small translucent
        // square is the easiest control on the page to miss. The near-opaque paper backing is
        // what keeps the outline heart readable over a pale garment.
        "focus-ring flex h-9 w-9 items-center justify-center bg-paper/90 text-ink transition-colors hover:bg-paper hover:text-strong",
        className,
      )}
    >
      {/* Filled vs outline is what says "saved" — it did the work even when the fill was
          red, so dropping the accent colour costs this control nothing. */}
      <Heart
        size={size}
        className={active ? "fill-strong text-strong" : ""}
        strokeWidth={ICON_WEIGHT}
        absoluteStrokeWidth
      />
    </button>
  );
}
