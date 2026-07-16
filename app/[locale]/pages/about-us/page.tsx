import Image from "next/image";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/pages/PageHero";
import { ABOUT_STORY, ABOUT_BLOCKS } from "@/lib/pages-content";

export const metadata: Metadata = { title: "Our Story" };

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div>
      <PageHero image="/assets/home/about-story.jpg" title="OUR STORY" />

      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        {ABOUT_STORY.map((p, i) => (
          <p key={i} className="mb-5 text-[15px] leading-relaxed text-ink/80">
            {p}
          </p>
        ))}
      </section>

      <div>
        {ABOUT_BLOCKS.map((b, i) => (
          <section
            key={b.n}
            className={`grid grid-cols-1 items-center md:grid-cols-2 ${i % 2 === 1 ? "md:[&>div:first-child]:order-2" : ""}`}
          >
            <div className="relative aspect-[4/3] md:aspect-[4/5]">
              <Image src={b.image} alt={b.title} fill sizes="50vw" className="object-cover" />
            </div>
            <div className="flex flex-col items-start gap-4 px-8 py-12 md:px-16">
              <span className="font-button text-3xl text-gold/60">#{b.n}</span>
              <h2 className="text-xl uppercase tracking-[0.14em]">{b.title}</h2>
              <p className="text-[15px] leading-relaxed text-ink/75">{b.body}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
