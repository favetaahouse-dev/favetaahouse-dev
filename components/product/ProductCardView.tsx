import Image from "next/image";
import { Link } from "@/lib/i18n-navigation";
import { Price } from "@/components/Price";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import type { ProductCardDTO } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

export type ProductCardLabels = { outOfStock: string; sale: string };

/**
 * Three across on desktop, not four: at a 2:3 image ratio a quarter-width column renders
 * the garment too small to judge, and three columns of a 1200px container land at ~380px
 * each — near the size the photography was shot for.
 *
 * Lives here rather than in ProductGrid because client components need it too, and that
 * module imports the server-only <ProductCard>: importing the constant from there dragged
 * an async server component into the client graph.
 */
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 md:gap-x-5 md:gap-y-14";

/**
 * The card's markup, with no data fetching and no hooks of its own, so it renders on
 * either side of the boundary: <ProductCard> resolves the labels on the server for the
 * catalogue pages, while the wishlist — which reads its handles from localStorage — passes
 * them in from a client component. Keeping one copy stops the two from drifting.
 */
export function ProductCardView({
  product,
  labels,
}: {
  product: ProductCardDTO;
  labels: ProductCardLabels;
}) {
  return (
    <div className="group relative flex flex-col">
      {/* 2:3 — a standing figure needs the extra height; 4:5 cropped every model at the hem. */}
      <div className="relative aspect-[2/3] overflow-hidden bg-mist">
        <Link
          href={`/products/${product.handle}`}
          className={cn("relative block h-full w-full", !product.inStock && "opacity-60")}
        >
          {product.image ? (
            <>
              <Image
                src={product.image}
                alt={product.title}
                fill
                sizes="(max-width:768px) 50vw, 33vw"
                className="object-cover transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-0"
              />
              {product.hoverImage && (
                <Image
                  src={product.hoverImage}
                  alt=""
                  fill
                  sizes="(max-width:768px) 50vw, 33vw"
                  className="object-cover opacity-0 transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-[10px] uppercase tracking-[0.2em] text-muted">
              {product.title}
            </div>
          )}
        </Link>

        {/* With no accent colour left, the two badges have to differ by treatment rather than
            hue: sale is a solid black slab, sold-out a pale chip. Two black slabs would be
            indistinguishable at a glance. */}
        {!product.inStock ? (
          <span className="badge absolute start-0 top-0 border border-line bg-paper/90 text-ink">
            {labels.outOfStock}
          </span>
        ) : product.onSale ? (
          <span className="badge absolute start-0 top-0 bg-strong text-white">{labels.sale}</span>
        ) : null}

        <div className="absolute end-2 top-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <WishlistButton handle={product.handle} />
        </div>
      </div>

      <div className="mt-4 flex flex-col items-start gap-1 text-start">
        <Link
          href={`/products/${product.handle}`}
          className="text-[16px] font-medium text-strong transition-opacity hover:opacity-70"
        >
          {product.title}
        </Link>
        <div className="text-[15px] text-ink">
          <Price cents={product.priceMin} compareAt={product.compareAtMax} />
        </div>
        {product.swatches.length > 1 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {product.swatches.slice(0, 5).map((s) => (
              <span
                key={s.color}
                title={s.color}
                className="h-3 w-3 border border-line"
                style={{ backgroundColor: s.hex ?? "#ccc" }}
              />
            ))}
            {product.swatches.length > 5 && (
              <span className="text-[10px] text-muted">+{product.swatches.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
