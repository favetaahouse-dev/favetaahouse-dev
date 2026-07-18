/**
 * Placeholder shown in the prerendered shell while a product grid streams in. Mirrors
 * ProductGrid's columns and the card's 4:5 image ratio so nothing shifts when the real
 * grid arrives.
 */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-4 md:gap-x-6 md:gap-y-14">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex animate-pulse flex-col">
          <div className="aspect-[4/5] w-full bg-cream" />
          <div className="mt-3.5 h-3 w-3/4 bg-cream" />
          <div className="mt-2 h-3 w-1/3 bg-cream" />
        </div>
      ))}
    </div>
  );
}
