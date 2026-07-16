"use client";

import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { Star } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import { TESTIMONIALS } from "@/lib/home-content";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={15}
          className={i <= Math.round(rating) ? "fill-star text-star" : "text-star/30"}
          strokeWidth={1}
        />
      ))}
    </div>
  );
}

export function Testimonials() {
  const t = useTranslations("home");
  const locale = useLocale();
  const [emblaRef] = useEmblaCarousel({
    align: "start",
    loop: true,
    direction: locale === "ar" ? "rtl" : "ltr",
  });

  return (
    <section className="bg-linen px-4 py-16 md:px-8">
      <h2 className="section-title mb-10">{t("wordsOfLove")}</h2>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-[0.75fr_1.25fr]">
        <div className="relative hidden aspect-[4/5] md:block">
          <Image src="/assets/home/lookbook.jpg" alt="" fill sizes="30vw" className="object-cover" />
        </div>
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {TESTIMONIALS.map((tm, i) => (
              <div key={i} className="min-w-0 flex-[0_0_100%] px-3 md:flex-[0_0_50%]">
                <div className="flex h-full flex-col gap-4 bg-paper p-8">
                  <Stars rating={tm.rating} />
                  <p className="flex-1 text-[15px] leading-relaxed text-ink/85">“{tm.quote}”</p>
                  <div>
                    <p className="text-sm font-semibold">{tm.name}</p>
                    <p className="text-xs text-muted">{tm.location}</p>
                  </div>
                  <Link
                    href={`/products/${tm.handle}`}
                    className="font-button text-[11px] uppercase tracking-[0.14em] text-gold hover:underline"
                  >
                    {t("shopTheLook")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
