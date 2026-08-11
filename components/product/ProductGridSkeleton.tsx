import { PRODUCT_GRID_CLASS } from "@/components/product/ProductCardView";

/**
 * Placeholder shown in the prerendered shell while a product grid streams in. It reuses
 * PRODUCT_GRID_CLASS rather than restating the columns, and mirrors the card's 2:3 image
 * ratio, so nothing shifts when the real grid arrives — the two used to be separate copies
 * of the same measurements, which is exactly how a skeleton drifts out of alignment.
 */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex animate-pulse flex-col">
          <div className="aspect-[2/3] w-full bg-mist" />
          <div className="mt-4 h-3.5 w-3/4 bg-mist" />
          <div className="mt-2 h-3 w-1/3 bg-mist" />
        </div>
      ))}
    </div>
  );
}
