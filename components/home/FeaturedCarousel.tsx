"use client";

import { useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { ProductCard } from "@/components/product/ProductCard";
import type { ProductCardDTO } from "@/lib/data/catalog";

export function FeaturedCarousel({ products }: { products: ProductCardDTO[] }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: true,
    direction: locale === "ar" ? "rtl" : "ltr",
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const id = setInterval(() => emblaApi.scrollNext(), 6000);
    return () => clearInterval(id);
  }, [emblaApi]);

  if (products.length === 0) return null;

  return (
    <section className="bg-linen px-4 py-16 md:px-8">
      <h2 className="section-title mb-10 hidden md:block">{t("exploreCreation")}</h2>
      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {products.map((p) => (
              <div key={p.handle} className="min-w-0 flex-[0_0_50%] px-2 md:flex-[0_0_25%] md:px-3">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={scrollPrev}
          aria-label="Previous"
          className="absolute start-0 top-[35%] z-10 flex h-10 w-10 items-center justify-center bg-paper/80 hover:bg-paper"
        >
          <ChevronLeft size={20} className="flip-x" />
        </button>
        <button
          onClick={scrollNext}
          aria-label="Next"
          className="absolute end-0 top-[35%] z-10 flex h-10 w-10 items-center justify-center bg-paper/80 hover:bg-paper"
        >
          <ChevronRight size={20} className="flip-x" />
        </button>
      </div>
    </section>
  );
}
