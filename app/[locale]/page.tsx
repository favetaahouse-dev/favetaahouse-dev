import { setRequestLocale, getTranslations } from "next-intl/server";
import { getNewArrivals } from "@/lib/data/catalog";
import { getNavCategories } from "@/lib/data/navigation";
import { getHomeMedia, getHomeSectionTitles } from "@/lib/content";
import { Hero } from "@/components/home/Hero";
import { TrendyTabs } from "@/components/home/TrendyTabs";
import { StoryBand } from "@/components/home/StoryBand";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Independent cached reads ("products" / "nav" / "content"), so they resolve together rather
  // than in series.
  const [products, categories, heroMedia, titles, t] = await Promise.all([
    getNewArrivals(60, locale),
    getNavCategories(locale),
    getHomeMedia(),
    getHomeSectionTitles(locale),
    getTranslations({ locale, namespace: "home" }),
  ]);

  // The filter offers the nav's own category list — same labels, same order — so the two can
  // never disagree. The two caches expire on different tags, so a category is kept only if the
  // grid actually holds a piece of it: a button over an empty grid is worse than no button.
  const filters = categories.filter((c) => products.some((p) => p.category === c.value));

  return (
    <>
      <Hero media={heroMedia} />
      <TrendyTabs title={titles.trendy || t("trendy")} products={products} categories={filters} />
      <StoryBand />
    </>
  );
}
