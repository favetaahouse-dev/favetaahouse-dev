import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Gem, ShieldCheck, Truck } from "lucide-react";
import { Link } from "@/lib/i18n-navigation";
import { WHY_US, GALLERY_IMAGES } from "@/lib/home-content";
import { getSiteSettings } from "@/lib/content";

const WHY_ICONS = { shield: ShieldCheck, gem: Gem, truck: Truck };

export async function ShopSaleButton() {
  const t = await getTranslations("home");
  return (
    <div className="flex justify-center bg-cream py-9">
      <Link href="/collections/sales" className="btn-brand">
        {t("shopSale")}
      </Link>
    </div>
  );
}

/* Dark band between the two linen sections — the homepage's one deliberate pause.
   Columns are split by hairlines: horizontal when stacked, inline-start when in a row. */
export async function WhyUs() {
  const t = await getTranslations("home");
  return (
    <section className="bg-footer px-6 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow mb-4 text-center !text-gold">{t("whyEyebrow")}</p>
        <h2 className="section-title text-footer-fg">{t("whyTitle")}</h2>
        <span className="mx-auto mt-8 mb-14 block h-px w-12 bg-gold/50 md:mb-20" />

        <div className="grid grid-cols-1 md:grid-cols-3">
          {WHY_US.map((item) => {
            const Icon = WHY_ICONS[item.icon];
            return (
              <Link
                key={item.key}
                href={item.href}
                className="group flex flex-col items-center gap-5 border-t border-footer-fg/12 px-4 py-10 text-center first:border-t-0 md:border-t-0 md:border-s md:px-8 md:py-0 md:first:border-s-0"
              >
                <Icon
                  size={30}
                  strokeWidth={1}
                  className="text-gold transition-transform duration-500 group-hover:-translate-y-1"
                  aria-hidden
                />
                <h3 className="display text-[1.3rem] text-footer-fg">{t(item.key)}</h3>
                <p className="max-w-[28ch] text-[13px] leading-relaxed text-footer-fg/55">
                  {t(item.desc)}
                </p>
                {/* Slide on the wrapper, mirror on the glyph — .flip-x is a transform,
                    so keeping them on separate elements avoids clobbering either one. */}
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
                  <ArrowRight
                    size={16}
                    strokeWidth={1.25}
                    className="flip-x text-gold opacity-40 transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export async function InstagramGallery() {
  const t = await getTranslations("home");
  const { instagram } = await getSiteSettings();
  return (
    <section className="bg-cream px-4 py-16 md:px-8">
      <h2 className="section-title mb-10">{t("gallery")}</h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {GALLERY_IMAGES.map((src, i) => (
          <a
            key={src}
            href={instagram}
            target="_blank"
            rel="noopener"
            className="group relative block aspect-[3/4] overflow-hidden"
          >
            <Image
              src={src}
              alt={`Instagram ${i + 1}`}
              fill
              sizes="(max-width:768px) 50vw, 25vw"
              className="object-cover transition-transform duration-[1.2s] group-hover:scale-105"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
