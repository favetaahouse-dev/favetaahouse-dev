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

  // The filter is the nav's own Collections list — same entries, labels and order, New In first —
  // so the two can never disagree. Every entry shows even with nothing in it (the owner's call);
  // TrendyTabs says so rather than hiding the button.
  return (
    <>
      <Hero media={heroMedia} />
      <TrendyTabs title={titles.trendy || t("trendy")} products={products} categories={categories} />
      <StoryBand />
    </>
  );
}
