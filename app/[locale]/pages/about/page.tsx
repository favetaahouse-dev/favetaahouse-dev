import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n-navigation";
import { getHomeStory } from "@/lib/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  // Absolute: the title already names the house, so the "%s | FAVETAA" template would say it twice.
  return { title: { absolute: t("metaTitle") }, description: t("metaDescription") };
}

/** Message-key stems under `about.*` — each has a `…Title` and a `…Body`. */
const PRINCIPLES = ["cloth", "cut", "made"] as const;

/**
 * The house's own page. Four movements, each with one job: a statement, the photograph beside
 * who the house is, the three things it holds to, and a closing line that sends you back into
 * the collection.
 *
 * The photograph, the kicker, the "who we are" heading and the lead paragraph are the homepage
 * story's fields (Admin → Content → Home Page), so the owner edits the house's description in
 * one place and both pages follow; each falls back to the same translated default the homepage
 * uses. The rest is fixed copy in messages/*.json, and every claim in it is one the site
 * already makes elsewhere — nothing here asserts a fact the owner has not.
 *
 * No contact block: the footer directly underneath already carries the location, email and
 * WhatsApp, and saying it twice in one screen is noise.
 */
export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, th, story] = await Promise.all([
    getTranslations({ locale, namespace: "about" }),
    getTranslations({ locale, namespace: "home" }),
    getHomeStory(locale),
  ]);
  // Two-digit numerals in the page's own script: 01 on /, ٠١ on /ar.
  const numeral = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });

  return (
    <article>
      {/* ── Statement ── left-set, and held to a narrow measure so the headline breaks into
          two deliberate lines instead of running the width of the screen. */}
      <header className="container-lux pt-[var(--space-section-sm)] pb-[var(--space-section-sm)]">
        <p className="eyebrow">{story.heading || th("ourStory")}</p>
        <h1 className="display-xl mt-5 max-w-[15ch]">
          {t.rich("title", { em: (chunks) => <em>{chunks}</em> })}
        </h1>
        <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.8] text-muted">{t("deck")}</p>
      </header>

      {/* ── Who we are ── the photograph takes seven columns and the text four, one column of
          air between them, set to the image's foot rather than centred on it. That offset is the
          page's one break from the grid. Grid columns follow the writing direction, so on /ar
          the photograph moves to the right on its own. */}
      <section className="container-lux grid items-end gap-10 md:grid-cols-12 md:gap-8">
        <div className="relative aspect-[4/3] overflow-hidden bg-mist md:col-span-7">
          {/* Eager: on a desktop screen this photograph straddles the fold and is the page's
              Largest Contentful Paint, which lazy loading would hold back by a round trip. */}
          <Image
            src={story.image}
            alt=""
            fill
            loading="eager"
            sizes="(max-width: 768px) 100vw, 58vw"
            className="object-cover"
          />
        </div>
        <div className="md:col-span-4 md:col-start-9">
          <h2 className="display text-[1.75rem] md:text-[2rem]">{story.title || th("whoWeAre")}</h2>
          <span aria-hidden className="mt-5 block h-px w-12 bg-gold" />
          <p className="mt-6 max-w-prose text-[16px] leading-[1.9]">{story.lead || th("storyLead")}</p>
        </div>
      </section>

      {/* ── What guides us ── the one band on the page, so the three principles read as a
          set apart from the narrative either side of them. */}
      <section className="mt-[var(--space-section)] bg-mist py-[var(--space-section)]">
        <div className="container-lux">
          <h2 className="section-title">{t("principlesTitle")}</h2>
          <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
            {PRINCIPLES.map((key, i) => (
              <li key={key} className="border-t border-line pt-6">
                <span aria-hidden className="eyebrow">
                  {numeral.format(i + 1)}
                </span>
                <h3 className="display mt-4 text-[1.5rem]">{t(`${key}Title`)}</h3>
                <p className="mt-3 max-w-[38ch] text-[15px] leading-[1.9] text-muted">
                  {t(`${key}Body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Close ── one line in the display face, alone in its space, then the way back in. */}
      <section className="container-narrow pt-[var(--space-section)] text-center">
        <div aria-hidden className="ornament">
          <span />
        </div>
        <p className="display mx-auto mt-8 max-w-[20ch] text-[clamp(1.75rem,3.6vw,2.75rem)]">
          {t("closing")}
        </p>
        <Link href="/collections/all" className="btn-brand btn-arrow mt-10">
          {t("cta")}
        </Link>
      </section>
    </article>
  );
}
