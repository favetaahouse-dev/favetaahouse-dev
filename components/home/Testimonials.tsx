import Image from "next/image";
import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
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

/**
 * A server component. This used embla to scroll a fixed six-item list, which meant
 * shipping a carousel library to the homepage — and hydrating it — for something CSS
 * scroll-snap does natively. Scrolling follows the document's own direction, so the RTL
 * case needs no special handling either.
 */
export async function Testimonials() {
  const t = await getTranslations("home");

  return (
    <section className="bg-linen px-4 py-16 md:px-8">
      <h2 className="section-title mb-10">{t("wordsOfLove")}</h2>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-[0.75fr_1.25fr]">
        <div className="relative hidden aspect-[4/5] md:block">
          <Image src="/assets/home/lookbook.jpg" alt="" fill sizes="30vw" className="object-cover" />
        </div>
        <div className="-mx-3 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TESTIMONIALS.map((tm, i) => (
            <div key={i} className="min-w-0 flex-[0_0_100%] snap-start px-3 md:flex-[0_0_50%]">
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
    </section>
  );
}
