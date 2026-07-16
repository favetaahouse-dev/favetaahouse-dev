import Image from "next/image";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/pages/PageHero";
import { MATERIALS_PROSE, COLOR_FAMILIES } from "@/lib/pages-content";

export const metadata: Metadata = { title: "Materials & Colors" };

export default async function MaterialsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div>
      <PageHero
        image="/assets/home/our-material.jpg"
        title="OUR MATERIALS"
        subtitle="The finest materials and a palette that resonates with emotion"
      />

      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        {MATERIALS_PROSE.map((p, i) => (
          <p key={i} className="mb-5 text-[15px] leading-relaxed text-ink/80">
            {p}
          </p>
        ))}
        <div className="mt-6 space-y-3">
          {COLOR_FAMILIES.map((f) => (
            <p key={f.label} className="text-[15px] text-ink/80">
              <span className="text-muted">{f.label} like </span>
              <span className="font-medium text-ink">{f.colors}</span>
              <span className="text-muted"> {f.note}</span>
            </p>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 px-4 pb-16 md:grid-cols-2 md:px-8">
        {["/assets/home/craftman.jpg", "/assets/home/our-material.jpg"].map((src) => (
          <div key={src} className="relative aspect-[4/3] overflow-hidden">
            <Image
              src={src}
              alt=""
              fill
              sizes="50vw"
              className="object-cover transition-transform duration-[1.2s] hover:scale-105"
            />
          </div>
        ))}
      </section>
    </div>
  );
}
