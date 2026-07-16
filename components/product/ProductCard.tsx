"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import { Price } from "@/components/Price";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import type { ProductCardDTO } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: ProductCardDTO }) {
  const t = useTranslations("product");
  return (
    <div className="group relative flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden bg-cream">
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
                sizes="(max-width:768px) 50vw, 25vw"
                className="object-cover transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-0"
              />
              {product.hoverImage && (
                <Image
                  src={product.hoverImage}
                  alt=""
                  fill
                  sizes="(max-width:768px) 50vw, 25vw"
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

        {!product.inStock ? (
          <span className="badge absolute start-0 top-0 bg-ink/75 text-white">{t("outOfStock")}</span>
        ) : product.onSale ? (
          <span className="badge absolute start-0 top-0 bg-gold text-white">{t("sale")}</span>
        ) : null}

        <div className="absolute end-2 top-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <WishlistButton handle={product.handle} />
        </div>
      </div>

      <div className="mt-3.5 flex flex-col items-start gap-1 text-start">
        <Link
          href={`/products/${product.handle}`}
          className="text-[13px] tracking-[0.06em] transition-colors hover:text-gold"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {product.title}
        </Link>
        <div className="text-[13px]">
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
