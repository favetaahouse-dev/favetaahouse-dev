"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/components/providers/wishlist-context";
import { cn } from "@/lib/utils";

export function WishlistButton({
  handle,
  className,
  size = 18,
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
        toggle(handle);
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center bg-paper/80 backdrop-blur-sm transition-colors hover:bg-paper",
        className,
      )}
    >
      <Heart
        size={size}
        className={active ? "fill-gold text-gold" : "text-ink"}
        strokeWidth={1.5}
      />
    </button>
  );
}
