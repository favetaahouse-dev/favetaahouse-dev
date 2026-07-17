import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n-navigation";
import { WHY_US, GALLERY_IMAGES } from "@/lib/home-content";
import { getSiteSettings } from "@/lib/content";

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

export async function TravelCollage() {
  const t = await getTranslations("home");
  return (
    <section className="bg-cream px-4 pb-4 pt-14 md:px-8">
      <h2 className="section-title mb-8">{t("travelCollection")}</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {["/assets/home/travel-1.jpg", "/assets/home/travel-2.jpg"].map((src, i) => (
          <div
            key={src}
            className={`relative aspect-square overflow-hidden ${i === 1 ? "hidden md:block" : ""}`}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(max-width:768px) 100vw, 50vw"
              className="object-cover transition-transform duration-[1.2s] hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/15" />
          </div>
        ))}
      </div>
    </section>
  );
}

export async function TravelIntro() {
  const t = await getTranslations("home");
  return (
    <section className="bg-cream px-6 pb-16 pt-8">
      <p className="mx-auto max-w-2xl text-center text-[15px] leading-relaxed text-ink/80">
        {t("travelIntro")}
      </p>
    </section>
  );
}

export async function WhyUs() {
  const t = await getTranslations("home");
  return (
    <section className="bg-cream px-6 py-16">
      <h2 className="section-title mb-12">{t("whyTitle")}</h2>
      <div className="mx-auto grid max-w-4xl grid-cols-3 gap-6">
        {WHY_US.map((item) => (
          <Link key={item.key} href={item.href} className="group flex flex-col items-center gap-4 text-center">
            <Image
              src={item.icon}
              alt=""
              width={64}
              height={64}
              className="h-10 w-10 transition-transform group-hover:scale-110 md:h-16 md:w-16"
            />
            <span className="text-[11px] uppercase tracking-[0.14em] text-ink/80 md:text-sm">
              {t(item.key)}
            </span>
          </Link>
        ))}
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
