import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/lib/i18n-navigation";
import { getHomeStory } from "@/lib/content";

/**
 * The homepage's one piece of prose: a photograph beside a short statement of who the
 * house is, closing with a way further in.
 *
 * Copy comes from Admin → Content → Home Page and falls back to the translated defaults in
 * messages/*.json, so the section is complete in both languages before the owner touches
 * it and can be rewritten without a deploy.
 *
 * The image is a plain <img> via next/image with explicit dimensions rather than `fill`,
 * because the CMS field accepts an arbitrary host and a `fill` layout with no known aspect
 * ratio collapses when the URL 404s.
 */
export async function StoryBand() {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const story = await getHomeStory(locale);

  const title = story.title || t("whoWeAre");
  const heading = story.heading || t("ourStory");
  const lead = story.lead || t("storyLead");
  const body = story.body || t("storyBody");
  const cta = story.cta || t("learnMore");

  return (
    <section className="bg-mist px-4 pt-[70px] pb-[90px] md:px-8">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="section-title">{title}</h2>

        <div className="mt-12 grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-haze">
            <Image
              src={story.image}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          {/* text-start, not text-center: the paragraph is long enough that centring it
              would give every line a different left edge to find. */}
          <div className="text-start">
            <h3 className="display text-[1.5rem] md:text-[1.75rem]">{heading}</h3>
            <p className="mt-5 max-w-prose text-[15px] leading-[1.9]">{lead}</p>
            {body && <p className="mt-4 max-w-prose text-[13.5px] leading-[1.9] text-muted">{body}</p>}
            <Link href={story.ctaHref} className="btn-brand btn-arrow mt-8">
              {cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
